# Forensic Learning Record (Deep Inspection): vearch/vearch

> **Canonical Artifact**: `07_PROJECT_LEARNING/vearch-vearch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vearch/vearch](https://github.com/vearch/vearch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:09.272Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vearch/vearch`
- **Description**: Distributed vector search for AI-native applications
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2330 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/vearch/startup.go`
```
// Copyright 2019 The Vearch Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//	http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	_ "go.uber.org/automaxprocs"

	jaeger "github.com/uber/jaeger-client-go"
	jaegerConfig "github.com/uber/jaeger-client-go/config"
	"github.com/vearch/vearch/v3/internal/config"
	"github.com/vearch/vearch/v3/internal/debugutil"
	"github.com/vearch/vearch/v3/internal/entity"
	"github.com/vearch/vearch/v3/internal/master"
	"github.com/vearch/vearch/v3/internal/pkg/log"
	"github.com/vearch/vearch/v3/internal/pkg/metrics/mserver"
	"github.com/vearch/vearch/v3/internal/pkg/signals"
	"github.com/vearch/vearch/v3/internal/pkg/vearchlog"
	"github.com/vearch/vearch/v3/internal/ps"
	"github.com/vearch/vearch/v3/internal/router"
)

var (
	BuildVersion = "0.0"
	BuildTime    = "0"
	CommitID     = "xxxxx"
	confPath     string
	masterName   string
)

func init() {
	flag.StringVar(&confPath, "conf", getDefaultConfigFile(), "vearch config path")
	flag.StringVar(&masterName, "master", "", "vearch config for master name, is on local start two master must use it")
}

const (
	psTag               = "ps"
	masterTag           = "master"
	routerTag           = "router"
	allTag              = "all"
	DefaultResourceName = "default"
)

// initJaeger returns an instance of Jaeger Tracer that samples 100% of traces and logs all spans to stdout.
func initJaeger(service string, c *config.TracerCfg) io.Closer {
	cfg := &jaegerConfig.Configuration{
		ServiceName: service,
		Sampler: &jaegerConfig.SamplerConfig{
			Type:  c.SampleType,
			Param: c.SampleParam,
		},
		Reporter: &jaegerConfig.ReporterConfig{
			LocalAgentHostPort:         c.Host,
			LogSpans:                   false,
			DisableAttemptReconnecting: false,
			AttemptReconnectInterval:   1 * time.Minute,
		},
	}
	closer, err := cfg.InitGlobalTracer(service, jaegerConfig.Logger(jaeger.StdLogger))
	if err != nil {
		panic(fmt.Sprintf("ERROR: cannot init Jaeger: %v\n", err))
	}
	return closer
}

func main() {
	config.SetConfigVersion(BuildVersion, BuildTime, CommitID)

	flag.Parse()

	if confPath == "" {
		log.Error("can not get the config file, then exit the program!")
		os.Exit(1)
	}

	config.InitConfig(confPath)

	if config.Conf().Global.ResourceName == "" {
		config.Conf().Global.ResourceName = DefaultResourceName
	}

	if config.Conf().TracerCfg != nil {
		closer := initJaeger(config.Conf().Global.Name, config.Conf().TracerCfg)
		defer closer.Close()
	}
	args := flag.Args()
	if len(args) == 0 {
		args = []string{allTag}
	}

	tags := map[string]bool{allTag: false, psTag: false, routerTag: false, masterTag: false}

	for _, a := range args {
		if _, ok := tags[a]; !ok {
			log.Error("not found tags: %s it only support [ps, router, master or all]", a)
			os.Exit(1)
		}
		tags[a] = true
	}

	logName := strings.ToUpper(strings.Join(args, "-"))
	vearchlog.SetConfig(config.Conf().GetLogFileNum(), 1024*1024*config.Conf().GetLogFileSize())
	log.Regist(vearchlog.NewVearchLog(config.Conf().GetLogDir(), logName, config.Conf().GetLevel(), false))

	log.Info("start server by version:[%s] commitID:[%s]", BuildVersion, CommitID)
	log.Info("config file: %v", confPath)
	log.Info("runtime cpu num: %d", runtime.GOMAXPROCS(0))

	entity.SetPrefixAndSequence(config.Conf().Global.Name)
	log.Info("The cluster prefix is: %v", entity.PrefixEtcdClusterID)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if log.IsDebugEnabled() {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				default:
				}

				if config.LogInfoPrintSwitch {
					var mem runtime.MemStats
					runtime.ReadMemStats(&mem)
					log.Debug("mem.Alloc:", mem.Alloc, " mem.TotalAlloc:", mem.TotalAlloc, " mem.HeapAlloc:", mem.HeapAlloc, " mem.HeapSys:", mem.HeapSys, " routing :", runtime.NumGoroutine())
				}
				time.Sleep(3 * time.Minute)
			}
		}()
	}

	sigsHook := signals.NewSignalHook()

	var paths = make(map[string]bool)
	paths[config.Conf().GetDataDir()] = true
	paths[config.Conf().GetLogDir()] = true
	var models []string
	// start master
	if tags[masterTag] || tags[allTag] {
		if err := config.Conf().CurrentByMasterNameDomainIp(masterName); err != nil {
			log.Error("CurrentByMasterNameDomainIp master error: %v", err)
			os.Exit(1)
		}

		if err := config.Conf().Validate(config.Master); err != nil {
			log.Error("validate master error: %v", err)
			os.Exit(1)
		}

		self := config.Conf().Masters.Self()
		mserver.SetIp(self.Address, true)
		models = append(models, "master")

		s, err := master.NewServer(ctx)
		if err != nil {
			log.Error("new master error: %v", err)
			os.Exit(1)
		}
		sigsHook.AddSignalHook(func() {
			s.Stop()
		})
		go func() {
			if err := s.Start(); err != nil {
				log.Error("start master error: %v", err)
				os.Exit(1)
			}
		}()

		if port := config.Conf().Masters.Self().PprofPort; port > 0 {
			debugutil.StartUIPprofListener(int(port))
		}
	}

	// start ps
	if tags[psTag] || tags[allTag] {
		if err := config.Conf().Validate(config.PS); err != nil {
			log.Error("validate ps error: %v", err)
			os.Exit(1)
		}

		server := ps.NewServer(ctx)

		models = append(models, "ps")
		sigsHook.AddSignalHook(func() {
			if server != nil {
				err := server.Close()
				if err != nil {
					log.Error("close ps error: %v", err)
				}
			}
		})
		go func() {
			if err := server.Start(); err != nil {
				log.Error("start ps error: %v", err)
				os.Exit(1)
			}
		}()

		if port := config.Conf().PS.PprofPort; port > 0 {
			debugutil.StartUIPprofListener(int(port))
		}
	}

	// start router
	if tags[routerTag] || tags[allTag] {
		runtime.GOMAXPROCS(runtime.NumCPU())
		log.Info("router runtime cpu num: %d", runtime.GOMAXPROCS(0))
		if err := config.Conf().Validate(config.Router); err != nil {
			log.Error("validate router error: %v", err)
			os.Exit(1)
		}
		server, err := router.NewServer(ctx)
		if err != nil {
			log.Error("new router error: %v", err)
			os.Exit(1)
		}
		models = append(models, "router")
		sigsHook.AddSignalHook(func() {
			cancel()
			server.Shutdown()
		})
		go func() {
			if err := server.Start(); err != nil {
				log.Error("start router error: %v", err)
				os.Exit(1)
			}
		}()

		if port := config.Conf().Router.PprofPort; port > 0 {
			debugutil.StartUIPprofListener(int(port))
		}
	}

	var psPath []string
	for k := range paths {
		psPath = append(psPath, k)
	}

	mserver.Start(ctx, psPath)
	mserver.AddLabel("models", strings.Join(models, ","))

	sigsHook.WaitSignals()
	sigsHook.AsyncInvokeHooks()
	sigsHook.WaitUntilTimeout(30 * time.Second)
}

func getDefaultConfigFile() (defaultConfigFile string) {
	if currentExePath, err := getCurrentPath(); err == nil {
		path := filepath.Join(currentExePath, "config", "config.toml")
		if ok, err := pathExists(path); ok {
			return path
		} else if err != nil {
			log.Error("check path: %s err: %s", path, err.Error())
		}
	}

	if sourceCodeFileName, err := getCurrentSourceCodePath(); err == nil {
		lastIndex := strings.LastIndex(sourceCodeFileName, string(os.PathSeparator))
		path := filepath.Join(sourceCodeFileName[:lastIndex+1], "config", "config.toml")
		if ok, err := pathExists(path); ok {
			return path
		} else if err != nil {
			log.Error("check path: %s err: %s", path, err.Error())
		}
	}
	return
}

func getCurrentPath() (string, error) {
	_, file, _, ok := runtime.Caller(1)
	if !ok {
		return "", errors.New("cannot get current path")
	}
	path, err := filepath.A
```

### Core Architecture Module: `examples/golang/basic_usage/basic_usage.go`
```
package main

import (
	"context"
	"fmt"
	"time"

	client "github.com/vearch/vearch/v3/sdk/go"
	"github.com/vearch/vearch/v3/sdk/go/auth"
	"github.com/vearch/vearch/v3/sdk/go/entities/models"
)

func setupClient() *client.Client {
	host := "http://127.0.0.1:9001" // router url
	user := "root"
	secret := "secret"

	authConfig := auth.BasicAuth{UserName: user, Secret: secret}
	c, err := client.NewClient(client.Config{Host: host, AuthConfig: authConfig})
	if err != nil {
		panic(err)
	}
	return c
}

func main() {
	ctx := context.Background()

	dbName := "ts_db"
	spaceName := "ts_space"
	c := setupClient()
	var db *models.DB
	var space *models.Space

	// create DB
	db = &models.DB{
		Name: dbName,
	}
	err := c.Schema().DBCreator().WithDB(db).Do(ctx)
	if err != nil {
		panic(err)
	}

	// create space
	spaceCreator := c.Schema().SpaceCreator()
	space = &models.Space{
		Name:         spaceName,
		PartitionNum: 1,
		ReplicaNum:   1,
		Fields: []*models.Field{
			{
				Name: "field_string",
				Type: "string",
			},
			{
				Name: "field_float",
				Type: "float",
			},
			{
				Name: "field_int",
				Type: "integer",
			},
			{
				Name: "field_double",
				Type: "double",
			},
			{
				Name:      "field_vector",
				Type:      "vector",
				Dimension: 128,
				StoreType: "MemoryOnly",
				Index: &models.Index{
					Name: "gamma",
					Type: "HNSW",
					Params: &models.IndexParams{
						MetricType:        "InnerProduct",
						TrainingThreshold: 0,
						EfConstruction:    64,
						EfSearch:          32,
					},
				},
			},
		},
	}

	err = spaceCreator.WithDBName(dbName).WithSpace(space).Do(ctx)
	if err != nil {
		panic(err)
	}

	// upsert docs
	documents := []interface{}{
		map[string]interface{}{
			"_id":          "1",
			"field_int":    777,
			"field_float":  123.4,
			"field_vector": []float32{0.019698096, 0.041366003, 0.037426382, 0.088641435, 0.078792386, 0.07091314, 0.06303391, 0.011818858, 0.2028904, 0.11227915, 0.049245242, 0.03545657, 0.023637716, 0.04530562, 0.13000743, 0.10439991, 0.098490484, 0.04333581, 0.023637716, 0.037426382, 0.074852765, 0.059094287, 0.078792386, 0.033486765, 0.031516954, 0.07288296, 0.10833953, 0.13000743, 0.09455086, 0.039396193, 0.04727543, 0.03545657, 0.12606782, 0.061064098, 0.029547144, 0.011818858, 0.0137886675, 0.021667905, 0.065003715, 0.12606782, 0.03545657, 0.049245242, 0.09455086, 0.19698097, 0.12015839, 0.06303391, 0.11030934, 0.05712448, 0.19501115, 0.2028904, 0.1437961, 0.05318486, 0.06894334, 0.04530562, 0.027577335, 0.049245242, 0.05515467, 0.023637716, 0.0137886675, 0.03545657, 0.098490484, 0.13788667, 0.2028904, 0.04727543, 0.06697353, 0.15561496, 0.17728287, 0.08076219, 0.06697353, 0.037426382, 0.033486765, 0.04727543, 0.11621877, 0.10833953, 0.033486765, 0.041366003, 0.09061124, 0.16940363, 0.15167534, 0.06303391, 0.16940363, 0.04727543, 0.061064098, 0.06303391, 0.023637716, 0.05515467, 0.16152439, 0.17728287, 0.05712448, 0.08667162, 0.07288296, 0.049245242, 0.10636972, 0.039396193, 0.033486765, 0.0137886675, 0.06303391, 0.027577335, 0.019698096, 0.031516954, 0.04727543, 0.10636972, 0.15561496, 0.07682258, 0.13000743, 0.09061124, 0.09455086, 0.041366003, 0.025607524, 0.007879239, 0.039396193, 0.088641435, 0.023637716, 0.04530562, 0.074852765, 0.12803763, 0.13788667, 0.088641435, 0.05712448, 0.023637716, 0.13985649, 0.084701814, 0.059094287, 0.015758477, 0.0137886675, 0.027577335, 0.037426382, 0.07682258},
		},
		map[string]interface{}{
			"_id":          "2",
			"field_int":    888,
			"field_float":  345.6,
			"field_vector": []float32{28.0, 14.0, 29.0, 55.0, 3.0, 27.0, 2.0, 10.0, 68.0, 7.0, 3.0, 19.0, 1.0, 0.0, 1.0, 126.0, 23.0, 2.0, 7.0, 15.0, 5.0, 0.0, 1.0, 74.0, 5.0, 4.0, 9.0, 33.0, 49.0, 9.0, 4.0, 2.0, 27.0, 13.0, 1.0, 5.0, 56.0, 101.0, 12.0, 10.0, 140.0, 49.0, 4.0, 7.0, 8.0, 9.0, 7.0, 46.0, 34.0, 8.0, 12.0, 68.0, 34.0, 0.0, 1.0, 10.0, 34.0, 14.0, 8.0, 82.0, 115.0, 0.0, 0.0, 1.0, 18.0, 1.0, 2.0, 25.0, 51.0, 17.0, 16.0, 39.0, 57.0, 6.0, 23.0, 120.0, 5.0, 4.0, 19.0, 83.0, 66.0, 18.0, 43.0, 140.0, 13.0, 0.0, 2.0, 18.0, 13.0, 4.0, 8.0, 140.0, 56.0, 0.0, 2.0, 5.0, 14.0, 8.0, 13.0, 72.0, 7.0, 10.0, 2.0, 7.0, 35.0, 4.0, 25.0, 140.0, 2.0, 0.0, 0.0, 43.0, 50.0, 4.0, 9.0, 140.0, 28.0, 0.0, 0.0, 36.0, 9.0, 0.0, 2.0, 140.0, 19.0, 0.0, 9.0, 19.0},
		},
	}

	_, err = c.Data().Creator().WithDBName(dbName).WithSpaceName(spaceName).WithDocs(documents).Do(ctx)
	if err != nil {
		panic(err)
	}

	time.Sleep(5 * time.Second)

	// search docs
	vector := []models.Vector{
		{
			Field:   "field_vector",
			Feature: []float32{0.019698096, 0.041366003, 0.037426382, 0.088641435, 0.078792386, 0.07091314, 0.06303391, 0.011818858, 0.2028904, 0.11227915, 0.049245242, 0.03545657, 0.023637716, 0.04530562, 0.13000743, 0.10439991, 0.098490484, 0.04333581, 0.023637716, 0.037426382, 0.074852765, 0.059094287, 0.078792386, 0.033486765, 0.031516954, 0.07288296, 0.10833953, 0.13000743, 0.09455086, 0.039396193, 0.04727543, 0.03545657, 0.12606782, 0.061064098, 0.029547144, 0.011818858, 0.0137886675, 0.021667905, 0.065003715, 0.12606782, 0.03545657, 0.049245242, 0.09455086, 0.19698097, 0.12015839, 0.06303391, 0.11030934, 0.05712448, 0.19501115, 0.2028904, 0.1437961, 0.05318486, 0.06894334, 0.04530562, 0.027577335, 0.049245242, 0.05515467, 0.023637716, 0.0137886675, 0.03545657, 0.098490484, 0.13788667, 0.2028904, 0.04727543, 0.06697353, 0.15561496, 0.17728287, 0.08076219, 0.06697353, 0.037426382, 0.033486765, 0.04727543, 0.11621877, 0.10833953, 0.033486765, 0.041366003, 0.09061124, 0.16940363, 0.15167534, 0.06303391, 0.16940363, 0.04727543, 0.061064098, 0.06303391, 0.023637716, 0.05515467, 0.16152439, 0.17728287, 0.05712448, 0.08667162, 0.07288296, 0.049245242, 0.10636972, 0.039396193, 0.033486765, 0.0137886675, 0.06303391, 0.027577335, 0.019698096, 0.031516954, 0.04727543, 0.10636972, 0.15561496, 0.07682258, 0.13000743, 0.09061124, 0.09455086, 0.041366003, 0.025607524, 0.007879239, 0.039396193, 0.088641435, 0.023637716, 0.04530562, 0.074852765, 0.12803763, 0.13788667, 0.088641435, 0.05712448, 0.023637716, 0.13985649, 0.084701814, 0.059094287, 0.015758477, 0.0137886675, 0.027577335, 0.037426382, 0.07682258},
		},
	}

	result, err := c.Data().Searcher().WithDBName(dbName).WithSpaceName(spaceName).WithLimit(2).WithVectors(vector).Do(ctx)
	if err != nil {
		panic(err)
	}
	fmt.Printf("result %v\n", result.Docs.Data.Documents...)
}

```

### Core Architecture Module: `examples/python/example.py`
```
from vearch.config import Config
from vearch.core.db import Database, Space
from vearch.core.vearch import Vearch
from vearch.schema.field import Field
from vearch.schema.space import SpaceSchema
from vearch.utils import DataType, MetricType, VectorInfo
from vearch.schema.index import (
    IvfPQIndex,
    Index,
    ScalarIndex,
    HNSWIndex,
    IvfFlatIndex,
    BinaryIvfIndex,
    FlatIndex,
    GPUIvfPQIndex,
)
from vearch.filter import Filter, Condition, FieldValue
import logging
from typing import List
import json
from vearch.exception import SpaceException, DocumentException, VearchException
import random


logger = logging.getLogger("vearch")


def create_space_schema() -> SpaceSchema:
    book_name = Field(
        "book_name",
        DataType.STRING,
        desc="the name of book",
        index=ScalarIndex("book_name_idx"),
    )
    book_num = Field(
        "book_num",
        DataType.INTEGER,
        desc="the num of book",
        index=ScalarIndex("book_num_idx"),
    )
    book_vector = Field(
        "book_character",
        DataType.VECTOR,
        FlatIndex("book_vec_idx", MetricType.Inner_product),
        dimension=512,
    )
    ractor_address = Field(
        "ractor_address", DataType.STRING, desc="the place of the book put"
    )
    space_schema = SpaceSchema(
        "book_info", fields=[book_name, book_num, book_vector, ractor_address]
    )
    return space_schema


def create_database(vc: Vearch, db):
    logger.debug(vc.client.host)
    ret = vc.create_database(db)
    logger.debug(ret.dict_str())
    return ret


def list_databases(vc: Vearch):
    logger.debug(vc.client.host)
    ret = vc.list_databases()
    logger.debug(ret)
    return ret


def list_spaces(vc: Vearch, db):
    logger.debug(vc.client.host)
    ret = vc.list_spaces(db)
    logger.debug(ret)
    return ret


def create_space(vc: Vearch, db, space_schema):
    ret = vc.create_space(db, space_schema)
    print("######", ret.data, ret.msg)
    return ret


# def upsert_document(vc: Vearch) -> List:
#     import random
#     ractor = ["ractor_logical", "ractor_industry", "ractor_philosophy"]
#     book_name_template = "abcdefghijklmnopqrstuvwxyz0123456789"
#     data = []
#     num=[12,34,56,74,53,11,14,9]
#     for i in range(8):
#         book_item = ["".join(random.choices(book_name_template, k=8)),
#                      num[i],
#                      [random.uniform(0, 1) for _ in range(512)],
#                      ractor[random.randint(0, 2)]]
#         data.append(book_item)
#         logger.debug(book_item)
#     space = Space("database_test", "book_info")
#     ret = space.upsert(data)
#     assert len(ret.get_document_ids()) >= 0
#     if ret:
#         logger.debug("upsert result:" + str(ret.get_document_ids()))
#         return ret.get_document_ids()
#     return []


def upsert_document_from_vearch(vc: Vearch, db, space_name, data) -> List:
    ret = vc.upsert(db, space_name, data)
    if ret:
        logger.debug("upsert result:" + str(ret.get_document_ids()))
        print(len(ret.get_document_ids()))
        return ret.get_document_ids()


def query_documents_from_vearch(vc: Vearch, db, space_name, ids, data):
    ret = vc.query(db, space_name, ids, data)
    print(ret, ret.__dict__)
    print("query document", ret.documents)


def query_documents(ids: List):
    space = Space("database_test", "book_info")
    ret = space.query(ids)
    print("query document", ret.documents)


def search_documets():
    import random

    space = Space("database_test", "book_info")

    feature = [random.uniform(0, 1) for _ in range(512)]
    vi = VectorInfo("book_character", feature)
    ret = space.search(
        vector_infos=[
            vi,
        ],
        limit=7,
    )
    print("search document", ret.documents)


def search_documets_from_vearch(vc: Vearch):
    import random

    feature = [random.uniform(0, 1) for _ in range(512)]
    vi = VectorInfo("book_character", feature)
    ret = vc.search(
        "database_test",
        "book_info",
        vector_infos=[
            vi,
        ],
        limit=7,
    )
    print("search document", ret.documents)


def query_documnet_by_filter_of_vearch(vc: Vearch, filters):
    ret = vc.query("database_test", "book_info", filter=filters, limit=2)
    print("search document", ret.documents)


def search_doc_by_filter_of_vearch(vc: Vearch, filters):
    import random

    feature = [random.uniform(0, 1) for _ in range(512)]
    vi = VectorInfo("book_character", feature)

    ret = vc.search(
        "database_test",
        "book_info",
        vector_infos=[
            vi,
        ],
        filter=filters,
        limit=3,
    )
    print("search document", ret.documents)


def is_database_exist(vc: Vearch, db):
    ret = vc.is_database_exist(db)
    return ret


def is_space_exist(vc: Vearch, db, space_name):
    ret, d, spaces = vc.is_space_exist(db, space_name)
    logger.debug(ret)
    return ret, d, spaces


def delete_space(vc: Vearch, db, space_name):
    ret = vc.drop_space(db, space_name)
    print(ret.__dict__, ret.data, ret.msg)


def drop_database(vc: Vearch, db):
    ret = vc.drop_database(db)
    print(ret.__dict__, ret.code)


def query_documnet_by_filter(filters):

    space = Space("database_test", "book_info")
    ret = space.query(filter=filters, limit=2)
    print("query document", ret.documents)


def search_doc_by_filter(filters):
    import random

    space = Space("database_test", "book_info")
    feature = [random.uniform(0, 1) for _ in range(512)]
    vi = VectorInfo("book_character", feature)

    ret = space.search(
        vector_infos=[
            vi,
        ],
        filter=filters,
        limit=3,
    )
    if ret is not None:
        print("search document", ret.documents)


if __name__ == "__main__":
    # should set your host url
    config = Config(host="http://localhost:9001", token="secret")
    vc = Vearch(config)
    db_exist_ret = is_database_exist(vc, "database_test_not_exist")
    print("is_database_exist", db_exist_ret)

    if not db_exist_ret:
        create_ret = create_database(vc, "database_test_not_exist")
        print("create_ret", create_ret.__dict__)

    dbs = list_databases(vc)
    print("dbs", dbs, dbs[0].__dict__)
    book_name = Field(
        "book_name",
        DataType.STRING,
        desc="the name of book",
        index=ScalarIndex("book_name_idx"),
    )
    book_num = Field(
        "book_num",
        DataType.INTEGER,
        desc="the num of book",
        index=ScalarIndex("book_num_idx"),
    )

    space_exist, res, _ = is_space_exist(
        vc, "database_test_not_exist", "book_info_ivfpq"
    )
    print(" is space exist:::", space_exist)

    dim = 512
    if not space_exist:
        cr_ret_q = create_space(
            vc,
            "database_test_not_exist",
            SpaceSchema(
                "book_info_ivfpq",
                [
                    book_name,
                    book_num,
                    Field(
                        "book_character",
                        DataType.VECTOR,
                        IvfPQIndex(
                            "book_vec_idx", MetricType.Inner_product, 2048, int(dim / 4)
                        ),
                        dimension=dim,
                    ),
                ],
            ),
        )
        print(cr_ret_q.__dict__)
        cr_ret_t = create_space(
            vc,
            "database_test_not_exist",
            SpaceSchema(
                "book_info_ivfflat",
                [
                    book_name,
                    book_num,
                    Field(
                        "book_character",
                        DataType.VECTOR,
                        IvfFlatIndex("book_vec_idx", MetricType.Inner_product, 2048),
                        dimension=dim,
                    ),
                ],
            ),
        )
        print(cr_ret_t.__dict__)

        cr_ret_i = create_space(
            vc,
            
```

### Core Architecture Module: `internal/client/client.go`
```
// Copyright 2019 The Vearch Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

package client

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/patrickmn/go-cache"
	"github.com/smallnest/rpcx/share"
	"github.com/spaolacci/murmur3"
	"github.com/spf13/cast"
	"github.com/vearch/vearch/v3/internal/config"
	"github.com/vearch/vearch/v3/internal/engine/sdk/go/gamma"
	"github.com/vearch/vearch/v3/internal/entity"
	"github.com/vearch/vearch/v3/internal/entity/request"
	"github.com/vearch/vearch/v3/internal/entity/response"
	"github.com/vearch/vearch/v3/internal/master/store"
	"github.com/vearch/vearch/v3/internal/pkg/atomic"
	"github.com/vearch/vearch/v3/internal/pkg/cbbytes"
	"github.com/vearch/vearch/v3/internal/pkg/log"
	"github.com/vearch/vearch/v3/internal/pkg/number"
	"github.com/vearch/vearch/v3/internal/proto/vearchpb"
)

// Client include client of master and ps
type Client struct {
	master *masterClient
	ps     *psClient
}

// NewClient create a new client by config
func NewClient(conf *config.Config) (client *Client, err error) {
	client = &Client{}
	err = client.initPsClient()
	if err != nil {
		return nil, err
	}
	err = client.initMasterClient(conf)
	if err != nil {
		return nil, err
	}
	return client, err
}

func (client *Client) initPsClient() error {
	client.ps = &psClient{client: client}
	client.ps.initFaultylist()
	return nil
}

func (client *Client) initMasterClient(conf *config.Config) error {
	etcdStore, err := store.OpenStore("etcd", conf.GetEtcdAddress())
	if err != nil {
		return err
	}

	client.master = &masterClient{client: client, Store: etcdStore, cfg: conf}
	return nil
}

// Master return master client
func (client *Client) Master() *masterClient {
	return client.master
}

// PS return ps client
func (client *Client) PS() *psClient {
	return client.ps
}

// Stop stop client
func (client *Client) Stop() {
	client.master.Stop()
	client.ps.Stop()
}

// Space return space by dbname and space name
func (client *Client) Space(ctx context.Context, dbName, spaceName string) (*entity.Space, error) {
	return client.Master().Cache().SpaceByCache(ctx, dbName, spaceName)
}

const (
	// MessageID the key of message
	MessageID = "message_id"
)

// NewRouterRequest create a new request for router
func NewRouterRequest(ctx context.Context, client *Client) *routerRequest {
	return &routerRequest{ctx: ctx, client: client, md: make(map[string]string), errNotify: make(chan struct{})}
}

type routerRequest struct {
	ctx       context.Context
	client    *Client
	md        map[string]string
	head      *vearchpb.RequestHead
	docs      []*vearchpb.Document
	space     *entity.Space
	sendMap   map[entity.PartitionID]*vearchpb.PartitionData
	clientMap sync.Map
	// Err if error else nil
	Err error

	errOnce   sync.Once
	errNotify chan struct{}
}

// GetMD
func (r *routerRequest) GetMD() map[string]string {
	return r.md
}

// SetMsgID
func (r *routerRequest) SetMsgID(requstId string) *routerRequest {
	r.md[MessageID] = requstId
	return r
}

// GetMsgID
func (r *routerRequest) GetMsgID() string {
	msgID, ok := r.md[MessageID]
	if ok {
		return msgID
	}
	msgID = uuid.NewString()
	r.md[MessageID] = msgID
	return msgID
}

func (r *routerRequest) signalErr() {
	r.errOnce.Do(func() { close(r.errNotify) })
}

// SetMethod set method
func (r *routerRequest) SetMethod(method string) *routerRequest {
	r.md[HandlerType] = method
	return r
}

// SetHead Set head
func (r *routerRequest) SetHead(head *vearchpb.RequestHead) *routerRequest {
	r.head = head
	return r
}

// SetSpace set space by dbName and spaceName
func (r *routerRequest) SetSpace() *routerRequest {
	if r.Err != nil {
		return r
	}
	r.space, r.Err = r.client.Space(r.ctx, r.head.DbName, r.head.SpaceName)
	return r
}

// SetDocs set docs
func (r *routerRequest) SetDocs(docs []*vearchpb.Document) *routerRequest {
	if r.Err != nil {
		return r
	}
	r.docs = docs
	for _, doc := range r.docs {
		if doc == nil {
			r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, errors.New("the doc is nil"))
			return r
		}
		for _, field := range doc.Fields {
			if _, ok := r.space.SpaceProperties[field.Name]; !ok {
				r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("the field[%s] in doc not needed in space", field.Name))
				return r
			}
		}
	}
	return r
}

// SetDocsField Set _id field into doc
func (r *routerRequest) SetDocsField() *routerRequest {
	if r.Err != nil {
		return r
	}
	for _, doc := range r.docs {
		key, err := generateUUID(doc.PKey)
		if err != nil {
			r.Err = err
			return r
		}
		doc.PKey = key
		field := &vearchpb.Field{Name: entity.IdField}

		field.Value = []byte(doc.PKey)
		field.Type = vearchpb.FieldType_STRING
		doc.Fields = append(doc.Fields, field)
	}
	return r
}

// SetDocsByKey  return docs by a series of primary key
func (r *routerRequest) SetDocsByKey(keys []string) *routerRequest {
	if r.Err != nil {
		return r
	}
	r.docs, r.Err = setDocs(keys)
	return r
}

// SetDocsBySpecifyKey  return docs by a series of primary key with long type
func (r *routerRequest) SetDocsBySpecifyKey(keys []string) *routerRequest {
	if r.Err != nil {
		return r
	}
	r.docs, r.Err = setDocs(keys)
	return r
}

// PartitionDocs split docs into different partition
func (r *routerRequest) PartitionDocs() *routerRequest {
	if r.Err != nil {
		return r
	}
	dataMap := make(map[entity.PartitionID]*vearchpb.PartitionData)
	for _, doc := range r.docs {
		partitionID := r.space.PartitionId(murmur3.Sum32WithSeed([]byte(doc.PKey), 0))
		item := &vearchpb.Item{Doc: doc}
		if d, ok := dataMap[partitionID]; ok {
			d.Items = append(d.Items, item)
		} else {
			items := make([]*vearchpb.Item, 0)
			d = &vearchpb.PartitionData{PartitionID: partitionID, MessageID: r.GetMsgID(), Items: items}
			dataMap[partitionID] = d
			d.Items = append(d.Items, item)
		}

	}
	r.sendMap = dataMap
	return r
}

// Docs in specify partition
func (r *routerRequest) PartitionDocsById(partitionId uint32) *routerRequest {
	if r.Err != nil {
		return r
	}
	dataMap := make(map[entity.PartitionID]*vearchpb.PartitionData)
	for _, doc := range r.docs {
		item := &vearchpb.Item{Doc: doc}
		if d, ok := dataMap[partitionId]; ok {
			d.Items = append(d.Items, item)
		} else {
			items := make([]*vearchpb.Item, 0)
			d = &vearchpb.PartitionData{PartitionID: partitionId, MessageID: r.GetMsgID(), Items: items}
			dataMap[partitionId] = d
			d.Items = append(d.Items, item)
		}

	}
	r.sendMap = dataMap
	return r
}

// UpsertByPartitions split docs by specify partitons
func (r *routerRequest) UpsertByPartitions(partitions []uint32) *routerRequest {
	if r.Err != nil {
		return r
	}
	partitionID := uint32(0)
	dataMap := make(map[entity.PartitionID]*vearchpb.PartitionData)
	// partition by specify rule
	if r.space.PartitionRule != nil {
		for _, doc := range r.docs {
			found := false
			for _, field := range doc.Fields {
				if field.Name == r.space.PartitionRule.Field {
					found = true
					pids, err := r.space.PartitionIdsByRangeField(field.Value, field.Type)
					if err != nil {
						r.Err = err
						return r
					}
					if len(pids) == 1 {
						partitionID = pids[0]
					} else {
						hash_index := murmur3.Sum32WithSeed([]byte(doc.PKey), 0) % uint32(len(pids))
						partitionID = pids[hash_index]
					}
					break
				}
			}
			if !found {
				r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("docum
```

### Core Architecture Module: `internal/client/master.go`
```
// Copyright 2019 The Vearch Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

package client

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/spf13/cast"
	"github.com/vearch/vearch/v3/internal/config"
	"github.com/vearch/vearch/v3/internal/entity"
	httpResonse "github.com/vearch/vearch/v3/internal/entity/response"
	"github.com/vearch/vearch/v3/internal/master/store"
	"github.com/vearch/vearch/v3/internal/pkg/errutil"
	"github.com/vearch/vearch/v3/internal/pkg/log"
	"github.com/vearch/vearch/v3/internal/pkg/netutil"
	"github.com/vearch/vearch/v3/internal/pkg/vjson"
	"github.com/vearch/vearch/v3/internal/proto/vearchpb"
	clientv3 "go.etcd.io/etcd/client/v3"
)

const (
	DefaultPsTimeOut = 5
)

// masterClient is  used for router and partition server,not for master administrator. This client is mainly used to communicate with etcd directly,with out business logic
// if method has query , it not use cache
type masterClient struct {
	client *Client
	store.Store
	cfg      *config.Config
	cliCache *clientCache
}

// Client return the masterClient.client not masterClient
func (m *masterClient) Client() *Client {
	return m.client
}

// Cache return the clientCache of client
func (m *masterClient) Cache() *clientCache {
	return m.cliCache
}

// Config return the config of client
func (m *masterClient) Config() *config.Config {
	return m.cfg
}

// FlushCacheJob reset the client.cliCache
func (m *masterClient) FlushCacheJob(ctx context.Context) error {
	cliCache, err := newClientCache(ctx, m)
	if err != nil {
		return err
	}

	old := m.cliCache
	m.cliCache = cliCache
	if old != nil {
		old.stopCacheJob()
	}

	return nil
}

// Stop stop the cache job
func (m *masterClient) Stop() {
	if m.cliCache != nil {
		m.cliCache.stopCacheJob()
	}
}

// QueryDBId2Name query db name from etcd by key /db/id/{dbid}
func (m *masterClient) QueryDBId2Name(ctx context.Context, id int64) (string, error) {
	bytes, err := m.Get(ctx, entity.DBKeyId(id))
	if err != nil {
		return "", err
	}
	if bytes == nil {
		return "", vearchpb.NewError(vearchpb.ErrorEnum_DB_NOT_EXIST, nil)
	}
	return string(bytes), nil
}

// QueryDBName2ID query db id from etcd by key /db/name/{db name}
func (m *masterClient) QueryDBName2ID(ctx context.Context, name string) (int64, error) {
	if bytes, err := m.Get(ctx, entity.DBKeyName(name)); err != nil {
		return -1, err
	} else if bytes == nil {
		return -1, vearchpb.NewError(vearchpb.ErrorEnum_DB_NOT_EXIST, nil)
	} else {
		return cast.ToInt64E(string(bytes))
	}
}

// QueryPartition query partition from etcd by key /partition/{partitionID}
func (m *masterClient) QueryPartition(ctx context.Context, partitionID entity.PartitionID) (*entity.Partition, error) {
	bytes, err := m.Get(ctx, entity.PartitionKey(partitionID))
	if err != nil {
		return nil, err
	}
	if bytes == nil {
		return nil, vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_NOT_EXIST, fmt.Errorf("partition id %d", partitionID))
	}

	p := new(entity.Partition)
	err = vjson.Unmarshal(bytes, p)
	return p, err
}

// QueryServer query server from etcd by key /server/{id}
func (m *masterClient) QueryServer(ctx context.Context, id entity.NodeID) (*entity.Server, error) {
	bytes, err := m.Get(ctx, entity.ServerKey(id))
	if err != nil {
		log.Error("QueryServer() error, can not connect master, nodeId:[%d], err:[%v]", id, err)
		return nil, err
	}
	if bytes == nil {
		log.Error("server can not find on master, maybe server is offline, nodeId:[%d]", id)
		return nil, vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_NOT_EXIST, nil)
	}

	p := new(entity.Server)
	if err = vjson.Unmarshal(bytes, p); err != nil {
		log.Error("server find on master, but json.Unmarshal(bytes, p) error, nodeId:[%d], bytes:[%s], err:[%v]", id, string(bytes), err)
		return nil, err
	}

	return p, err
}

// QueryUser query user info from etcd by key /user/{username}
func (m *masterClient) QueryUser(ctx context.Context, username string) (*entity.User, error) {
	bytes, err := m.Get(ctx, entity.UserKey(username))
	if bytes == nil {
		return nil, vearchpb.NewError(vearchpb.ErrorEnum_USER_NOT_EXIST, err)
	}
	user := new(entity.User)
	if err = vjson.Unmarshal(bytes, user); err != nil {
		return nil, err
	}
	return user, nil
}

// QueryUserByPassword Query user info by /user/{username} and valid password
func (m *masterClient) QueryUserByPassword(ctx context.Context, username, password string) (*entity.User, error) {
	user, err := m.QueryUser(ctx, username)
	if err != nil {
		return nil, err
	}

	if user.Password != nil && *user.Password != password {
		return nil, vearchpb.NewError(vearchpb.ErrorEnum_AUTHENTICATION_FAILED, nil)
	}
	return user, nil
}

// QueryRole query role info from etcd by key /role/{rolename}
func (m *masterClient) QueryRole(ctx context.Context, rolename string) (*entity.Role, error) {
	bytes, err := m.Get(ctx, entity.RoleKey(rolename))
	if bytes == nil {
		return nil, vearchpb.NewError(vearchpb.ErrorEnum_ROLE_NOT_EXIST, err)
	}
	role := new(entity.Role)
	if err = vjson.Unmarshal(bytes, role); err != nil {
		return nil, err
	}
	return role, nil
}

// QueryServers scan all servers
func (m *masterClient) QueryServers(ctx context.Context) ([]*entity.Server, error) {
	_, bytesServers, err := m.PrefixScan(ctx, entity.PrefixServer)
	if err != nil {
		return nil, err
	}
	servers := make([]*entity.Server, 0, len(bytesServers))
	for _, bs := range bytesServers {
		var s = &entity.Server{}
		if err := vjson.Unmarshal(bs, s); err != nil {
			log.Error("unmarshl server err: %s", err.Error())
			continue
		}
		servers = append(servers, s)
	}

	return servers, err
}

// QuerySpaces query spaces by dbID
func (m *masterClient) QuerySpaces(ctx context.Context, dbID int64) ([]*entity.Space, error) {
	return m.QuerySpacesByKey(ctx, fmt.Sprintf("%s%d/", entity.PrefixSpace, dbID))
}

// QueryRouter query router ip list by key
func (m *masterClient) QueryRouter(ctx context.Context, key string) ([]string, error) {
	_, bytesRouterIP, err := m.PrefixScan(ctx, fmt.Sprintf("%s%s/", entity.PrefixRouter, key))
	if err != nil {
		return nil, err
	}
	routerIPs := make([]string, 0, len(bytesRouterIP))
	for _, bs := range bytesRouterIP {
		ip := strings.Split(string(bs), ":")[0]
		routerIPs = append(routerIPs, ip)
		log.Debugf("find key: [%s], routerIP: [%s]", key, ip)
	}
	return routerIPs, nil
}

// QuerySpacesByKey scan space by space prefix
func (m *masterClient) QuerySpacesByKey(ctx context.Context, prefix string) ([]*entity.Space, error) {
	_, bytesSpaces, err := m.PrefixScan(ctx, prefix)
	if err != nil {
		return nil, err
	}
	spaces := make([]*entity.Space, 0, len(bytesSpaces))
	for _, bs := range bytesSpaces {
		var space = &entity.Space{}
		if err := vjson.Unmarshal(bs, space); err != nil {
			log.Error("unmarshl space err: %s", err.Error())
			continue
		}
		spaces = append(spaces, space)
	}
	return spaces, err
}

// QuerySpaceConfigsByKey scan SpaceConfig by SpaceConfig prefix
func (m *masterClient) QuerySpaceConfigsByKey(ctx context.Context, prefix string) ([]*entity.SpaceConfig, error) {
	bytekeys, bytesSpaces, err := m.PrefixScan(ctx, prefix)
	if err != nil {
		return nil, err
	}
	spaceConfigs := make([]*entity.SpaceConfig, 0, len(bytesSpaces))
	for i, bs := range bytesSpaces {
		// Maintain compatibility with older versions
		key := string(bytekeys[i])
		spaceSplit := strings.Split(key, "/")
		var spaceConfig = &entity.SpaceConfig{}
		if len(spaceSplit) >= 3 {
			dbIDS
```

### Core Architecture Module: `internal/client/master_cache.go`
```
// Copyright 2019 The Vearch Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

package client

import (
	"context"
	"fmt"
	"net/http"
	"runtime/debug"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"slices"

	"github.com/cubefs/cubefs/depends/tiglabs/raft/proto"
	"github.com/patrickmn/go-cache"
	"github.com/spf13/cast"
	"github.com/vearch/vearch/v3/internal/config"
	"github.com/vearch/vearch/v3/internal/entity"
	httpResonse "github.com/vearch/vearch/v3/internal/entity/response"
	"github.com/vearch/vearch/v3/internal/pkg/errutil"
	"github.com/vearch/vearch/v3/internal/pkg/log"
	"github.com/vearch/vearch/v3/internal/pkg/vjson"
	"github.com/vearch/vearch/v3/internal/proto/vearchpb"
	"go.etcd.io/etcd/api/v3/mvccpb"
)

const retryNum = 3
const retrySleepTime = 200 * time.Microsecond

var spaceCacheLock sync.Mutex
var (
	userReloadWorkder      sync.Map
	spaceReloadWorkder     sync.Map
	partitionReloadWorkder sync.Map
	serverReloadWorkder    sync.Map
	aliasReloadWorkder     sync.Map
	roleReloadWorkder      sync.Map
)

type clientCache struct {
	sync.Map
	mc                                                                                                                 *masterClient
	cancel                                                                                                             context.CancelFunc
	lock                                                                                                               sync.Mutex
	userCache, spaceCache, spaceIDCache, partitionCache, serverCache, aliasCache, roleCache, mastersCache, routerCache *cache.Cache
}

func newClientCache(serverCtx context.Context, masterClient *masterClient) (*clientCache, error) {
	ctx, cancel := context.WithCancel(serverCtx)

	cc := &clientCache{
		mc:             masterClient,
		cancel:         cancel,
		userCache:      cache.New(cache.NoExpiration, cache.NoExpiration),
		spaceCache:     cache.New(cache.NoExpiration, cache.NoExpiration),
		spaceIDCache:   cache.New(cache.NoExpiration, cache.NoExpiration),
		partitionCache: cache.New(cache.NoExpiration, cache.NoExpiration),
		serverCache:    cache.New(cache.NoExpiration, cache.NoExpiration),
		aliasCache:     cache.New(cache.NoExpiration, cache.NoExpiration),
		roleCache:      cache.New(cache.NoExpiration, cache.NoExpiration),
		mastersCache:   cache.New(cache.NoExpiration, cache.NoExpiration),
		routerCache:    cache.New(cache.NoExpiration, cache.NoExpiration),
	}

	if err := cc.startCacheJob(ctx); err != nil {
		return nil, err
	}

	return cc, nil
}

// NewWatchServerCache watch ps server put and delete status
func NewWatchServerCache(serverCtx context.Context, cli *Client) error {
	ctx, cancel := context.WithCancel(serverCtx)

	cc := &clientCache{
		mc:          cli.Master(),
		cancel:      cancel,
		serverCache: cache.New(cache.NoExpiration, cache.NoExpiration),
	}

	err := cc.startWSJob(ctx)

	return err
}

func cachePartitionKey(space string, pid entity.PartitionID) string {
	return space + "/" + strconv.FormatInt(int64(pid), 10)
}

func CacheSpaceKey(db, space string) string {
	return db + "/" + space
}

func cacheServerKey(nodeID entity.NodeID) string {
	return cast.ToString(nodeID)
}
func cacheRouterIpKey(ip string) string {
	return "IP/" + ip
}

// find a user by cache
func (cliCache *clientCache) UserByCache(ctx context.Context, userName string) (*entity.User, error) {

	get, found := cliCache.userCache.Get(userName)
	if found {
		return get.(*entity.User), nil
	}

	_ = cliCache.reloadUserCache(ctx, true, userName)

	for i := 0; i < retryNum; i++ {
		time.Sleep(retrySleepTime)
		log.Debug("to find user by key:[%s] ", userName)
		if get, found = cliCache.userCache.Get(userName); found {
			return get.(*entity.User), nil
		}
	}

	return nil, vearchpb.NewError(vearchpb.ErrorEnum_USER_NOT_EXIST, nil)
}

func (cliCache *clientCache) reloadUserCache(ctx context.Context, sync bool, userName string) error {
	fun := func() error {
		log.Info("to reload user:[%s]", userName)
		user, err := cliCache.mc.QueryUser(ctx, userName)
		if err != nil {
			return vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("can not found user by name:[%s] err:[%s]", userName, err.Error()))
		}
		cliCache.userCache.Set(userName, user, cache.NoExpiration)
		return nil
	}

	if sync {
		return fun()
	}
	if _, ok := userReloadWorkder.LoadOrStore(userName, struct{}{}); !ok {
		go func() {
			defer userReloadWorkder.Delete(userName)
			err := fun()
			if err != nil {
				log.Error("reload user cache err:[%s]", err.Error())
			}
		}()
	}
	return nil
}

// find a role by cache
func (cliCache *clientCache) RoleByCache(ctx context.Context, roleName string) (*entity.Role, error) {

	get, found := cliCache.roleCache.Get(roleName)
	if found {
		return get.(*entity.Role), nil
	}

	_ = cliCache.reloadRoleCache(ctx, true, roleName)

	for i := 0; i < retryNum; i++ {
		time.Sleep(retrySleepTime)
		log.Debug("to find role by key:[%s] ", roleName)
		if get, found = cliCache.roleCache.Get(roleName); found {
			return get.(*entity.Role), nil
		}
	}

	return nil, vearchpb.NewError(vearchpb.ErrorEnum_ROLE_NOT_EXIST, nil)
}

func (cliCache *clientCache) reloadRoleCache(ctx context.Context, sync bool, roleName string) error {
	fun := func() error {
		log.Info("to reload role:[%s]", roleName)
		role, err := cliCache.mc.QueryRole(ctx, roleName)
		if err != nil {
			return vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("can not found role by name:[%s] err:[%s]", roleName, err.Error()))
		}
		cliCache.roleCache.Set(roleName, role, cache.NoExpiration)
		return nil
	}

	if sync {
		return fun()
	}
	if _, ok := roleReloadWorkder.LoadOrStore(roleName, struct{}{}); !ok {
		go func() {
			defer roleReloadWorkder.Delete(roleName)
			err := fun()
			if err != nil {
				log.Error("reload role cache err:[%s]", err.Error())
			}
		}()
	}
	return nil
}

// find a space by db and space name, if not exist so query it from etcd
func (cliCache *clientCache) SpaceByCache(ctx context.Context, db, space string) (*entity.Space, error) {
	key := CacheSpaceKey(db, space)

	get, found := cliCache.spaceCache.Get(key)
	if found {
		return get.(*entity.Space), nil
	}

	err := cliCache.reloadSpaceCache(ctx, false, db, space)
	if err != nil {
		log.Error("reload space cache err:[%s]", err.Error())
		return nil, err
	}

	for i := 0; i < retryNum; i++ {
		time.Sleep(retrySleepTime)
		log.Debug("to find space by key:[%s] ", key)
		if get, found = cliCache.spaceCache.Get(key); found {
			return get.(*entity.Space), nil
		}
	}

	return nil, vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("db:[%s] space:[%s] err:[%s]", db, space, vearchpb.NewError(vearchpb.ErrorEnum_SPACE_NOT_EXIST, nil)))
}

func (cliCache *clientCache) reloadSpaceCache(ctx context.Context, sync bool, db string, spaceName string) error {
	key := CacheSpaceKey(db, spaceName)

	fun := func() error {
		log.Info("to reload db:[%s] space:[%s]", db, spaceName)

		dbID, err := cliCache.mc.QueryDBName2ID(ctx, db)
		if err != nil {
			return vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("can not found db by name:[%s] err:[%s]", db, err.Error()))
		}

		space, err := cliCache.mc.QuerySpaceByName(ctx, dbID, spaceName)
		if err != nil {
			return vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("can not found space by space name:[%s] and db name:[%s] err:[%s]", spaceName, db, err.Error()))
		}
		if space.ResourceName != config.Conf().Global.ResourceName {
			log.Info("space n
```

### Core Architecture Module: `internal/client/ps.go`
```
// Copyright 2019 The Vearch Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

package client

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/patrickmn/go-cache"
	"github.com/spf13/cast"
	"github.com/vearch/vearch/v3/internal/entity"
	"github.com/vearch/vearch/v3/internal/pkg/log"
	server "github.com/vearch/vearch/v3/internal/pkg/server/rpc"
	"github.com/vearch/vearch/v3/internal/pkg/vjson"
	"github.com/vearch/vearch/v3/internal/proto/vearchpb"
)

// ClientType decide the method to choose raft
type ClientType int

const (
	LEADER ClientType = iota
	NOTLEADER
	RANDOM
	ALL
)

const (
	spaceRetry    = 3
	adaptRetry    = 3
	baseSleepTime = 200 * time.Millisecond
)

const (
	HandlerType  = "type"
	UnaryHandler = "UnaryHandler"

	SearchHandler        = "SearchHandler"
	QueryHandler         = "QueryHandler"
	DeleteByQueryHandler = "DeleteByQueryHandler"

	GetDocHandler                 = "GetDocHandler"
	GetDocsHandler                = "GetDocsHandler"
	GetDocsByPartitionHandler     = "GetDocsByPartitionHandler"
	GetNextDocsByPartitionHandler = "GetNextDocsByPartitionHandler"
	DeleteDocsHandler             = "DeleteDocsHandler"
	BatchHandler                  = "BatchHandler"
	ForceMergeHandler             = "ForceMergeHandler"
	RebuildIndexHandler           = "RebuildIndexHandler"
	FlushHandler                  = "FlushHandler"
	BackupHandler                 = "BackupHandler"
	IncrementBackupHandler        = "IncrementBackupHandler"
	BackupStatusHandler           = "BackupStatusHandler"
	DeleteBackupHandler           = "DeleteBackupHandler"
	ResourceLimitHandler          = "ResourceLimitHandler"

	CreatePartitionHandler = "CreatePartitionHandler"
	DeletePartitionHandler = "DeletePartitionHandler"
	DeleteReplicaHandler   = "DeleteReplicaHandler"
	UpdatePartitionHandler = "UpdatePartitionHandler"
	IndexChangePartitionHandler = "IndexChangePartitionHandler"
	StatsHandler           = "StatsHandler"
	IsLiveHandler          = "IsLiveHandler"
	PartitionInfoHandler   = "PartitionInfoHandler"
	ChangeMemberHandler    = "ChangeMemberHandler"
	EngineCfgHandler       = "EngineCfgHandler"
	MemoryLimitHandler     = "MemoryLimitHandler"
	RequestCancelHandler   = "RequestCancelHandler"
)

type psClient struct {
	client     *Client
	faultyList *cache.Cache
}

func (ps *psClient) Client() *Client {
	return ps.client
}

// when psclient stop, it will remove all client
func (ps *psClient) Stop() {
	ps.Client().Master().cliCache.Range(func(key, value interface{}) bool {
		value.(*rpcClient).close()
		ps.Client().Master().cliCache.Delete(key)
		return true
	})
}

func (ps *psClient) GetOrCreateRPCClient(ctx context.Context, nodeID entity.NodeID) *rpcClient {
	value, ok := ps.Client().Master().cliCache.Load(nodeID)
	if ok {
		return value.(*rpcClient).lastUse()
	}

	ps.Client().Master().cliCache.lock.Lock()
	defer ps.Client().Master().cliCache.lock.Unlock()

	value, ok = ps.Client().Master().cliCache.Load(nodeID)
	if ok {
		return value.(*rpcClient).lastUse()
	}

	log.Info("psClient not in psClientCache, make new psClient, nodeID:[%d]", nodeID)
	psServer, err := ps.Client().Master().cliCache.ServerByCache(ctx, nodeID)
	if err != nil {
		log.Error("Master().ServerByCache() err, can not get ps server from master, err: %s", err.Error())
		return nilClient
	}

	client, err := server.NewRpcClient(psServer.Ip + ":" + cast.ToString(psServer.RpcPort))
	if err != nil {
		log.Error("server.NewRpcClient() err, can not new rpc Client, err: %s", err.Error())
		return nilClient
	}

	if client != nil {
		c := &rpcClient{client: client, useTime: time.Now().UnixNano()}
		ps.Client().Master().cliCache.Store(nodeID, c)
		return c.lastUse()
	}

	return nilClient
}

func (ps *psClient) initFaultylist() {
	ps.faultyList = cache.New(time.Second*30, time.Second*5)
}

func (ps *psClient) AddFaulty(nodeID uint64, d time.Duration) {
	ps.faultyList.Set(fmt.Sprint(nodeID), nodeID, d)
}

func (ps *psClient) TestFaulty(nodeID uint64) bool {
	_, b := ps.faultyList.Get(fmt.Sprint(nodeID))
	return b
}

var nilClient = &rpcClient{}

type rpcClient struct {
	client  *server.RpcClient
	useTime int64
	_lock   sync.RWMutex
}

func (r *rpcClient) close() {
	r._lock.Lock()
	defer r._lock.Unlock()
	if e := r.client.Close(); e != nil {
		log.Error(e.Error())
	}
	r.client = nil
}

func (r *rpcClient) lastUse() *rpcClient {
	r.useTime = time.Now().UnixNano()
	return r
}

func (r *rpcClient) Execute(ctx context.Context, servicePath string, args interface{}, reply *vearchpb.PartitionData) error {
	if r == nilClient {
		return vearchpb.NewError(vearchpb.ErrorEnum_CREATE_RPCCLIENT_FAILED, nil)
	}
	return r.client.Execute(ctx, servicePath, args, reply)
}

func (r *rpcClient) GetConcurrent() int {
	if r == nilClient {
		return -1
	}
	return r.client.GetConcurrent()
}

// Execute add retry to handle no leader and not leader situation
func Execute(addr, servicePath string, args *vearchpb.PartitionData, reply *vearchpb.PartitionData) (err error) {
	ctx := context.Background()
	sleepTime := baseSleepTime
	for i := range adaptRetry {
		err = execute(ctx, addr, servicePath, args, reply)
		if err == nil {
			return nil
		}
		log.Error("%s retry %d, PartitionID: %d, PartitionRpcAddr: %s", servicePath, i, args.PartitionID, err.Error())

		if reply.Err != nil && reply.Err.Code == vearchpb.ErrorEnum_PARTITION_NO_LEADER {
			sleepTime = 2 * sleepTime
			time.Sleep(sleepTime)
			log.Warn("%s invoke no leader retry, PartitionID: %d, PartitionRpcAddr: %s", servicePath, args.PartitionID, addr)
			continue
		} else if reply.Err != nil && reply.Err.Code == vearchpb.ErrorEnum_PARTITION_NOT_LEADER {
			addrs := new(entity.Replica)
			err = vjson.Unmarshal([]byte(reply.Err.Msg), addrs)
			if err != nil {
				return err
			}
			addr = addrs.RpcAddr
			log.Debug("%s invoke not leader retry, PartitionID: %d, PartitionRpcAddr: %s", servicePath, args.PartitionID, addr)
			continue
		}
	}
	return err
}

// execute not use cache or pool, it only conn once and close client
func execute(ctx context.Context, addr, servicePath string, args *vearchpb.PartitionData, reply *vearchpb.PartitionData) error {
	client, err := server.NewRpcClient(addr)
	if err != nil {
		log.Error("NewRpcClient() err, err:[%s]", err.Error())
		return vearchpb.NewError(vearchpb.ErrorEnum_INTERNAL_ERROR, err)
	}
	defer func() {
		if err := client.Close(); err != nil {
			log.Error("close client err : %s", err.Error())
		}
	}()
	return client.Execute(ctx, servicePath, args, reply)
}

```

### Core Architecture Module: `internal/client/ps_admin_service.go`
```
// Copyright 2019 The Vearch Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

package client

import (
	"fmt"
	"strings"

	"github.com/vearch/vearch/v3/internal/entity"
	"github.com/vearch/vearch/v3/internal/pkg/log"
	"github.com/vearch/vearch/v3/internal/pkg/metrics/mserver"
	"github.com/vearch/vearch/v3/internal/pkg/vjson"
	"github.com/vearch/vearch/v3/internal/proto/vearchpb"
)

func operatePartition(method, addr string, space *entity.Space, pid uint32) error {
	bytes, e := vjson.Marshal(space)
	if e != nil {
		return e
	}
	args := &vearchpb.PartitionData{PartitionID: pid, Data: bytes}
	reply := new(vearchpb.PartitionData)
	err := Execute(addr, method, args, reply)
	if err != nil {
		return err
	}
	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		return vearchpb.NewError(reply.Err.Code, nil)
	}
	return nil
}

func CreatePartition(addr string, space *entity.Space, pid uint32) error {
	return operatePartition(CreatePartitionHandler, addr, space, pid)
}

func UpdatePartition(addr string, space *entity.Space, pid entity.PartitionID) error {
	return operatePartition(UpdatePartitionHandler, addr, space, pid)
}

// PartitionIndexChange ships an explicit add/remove-index instruction to a
// partition (routed to a raft CmdType_INDEXCHANGE).
func PartitionIndexChange(addr string, pid entity.PartitionID, ic *vearchpb.IndexChange) error {
	bytes, e := vjson.Marshal(ic)
	if e != nil {
		return e
	}
	args := &vearchpb.PartitionData{PartitionID: uint32(pid), Data: bytes}
	reply := new(vearchpb.PartitionData)
	if err := Execute(addr, IndexChangePartitionHandler, args, reply); err != nil {
		return err
	}
	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		return vearchpb.NewError(reply.Err.Code, nil)
	}
	return nil
}

func GetEngineCfg(addr string, pid entity.PartitionID) (cfg *entity.SpaceConfig, err error) {
	args := &vearchpb.PartitionData{PartitionID: pid, Type: vearchpb.OpType_GET}
	reply := new(vearchpb.PartitionData)
	err = Execute(addr, EngineCfgHandler, args, reply)
	if err != nil {
		return nil, err
	} else if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		return nil, vearchpb.NewError(reply.Err.Code, nil)
	}
	if reply.Data != nil {
		cfg := &entity.SpaceConfig{}
		err = vjson.Unmarshal(reply.Data, cfg)
		if err != nil {
			return nil, err
		}
		data, _ := vjson.Marshal(cfg)
		log.Debug("get engine cfg [%+v]", string(data))
		return cfg, nil
	}

	return nil, nil
}

func UpdateEngineCfg(addr string, cfg *entity.SpaceConfig, pid entity.PartitionID) error {
	value, err := vjson.Marshal(cfg)
	if err != nil {
		return err
	}

	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_CREATE}
	reply := new(vearchpb.PartitionData)
	err = Execute(addr, EngineCfgHandler, args, reply)
	if err != nil {
		return err
	} else if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		return vearchpb.NewError(reply.Err.Code, nil)
	}
	return nil
}

func BackupSpace(addr string, backup *entity.BackupSpaceRequest, pid entity.PartitionID) error {
	value, err := vjson.Marshal(backup)
	if err != nil {
		return err
	}

	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_CREATE}
	reply := new(vearchpb.PartitionData)
	err = Execute(addr, BackupHandler, args, reply)
	if err != nil {
		return err
	} else if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		return vearchpb.NewError(reply.Err.Code, nil)
	}
	return nil
}

func OperateBackupOrRestore(addr string, backup *entity.BackupOrRestoreRequest, pid entity.PartitionID) error {
	value, err := vjson.Marshal(backup)
	if err != nil {
		return err
	}

	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_CREATE}
	reply := new(vearchpb.PartitionData)
	err = Execute(addr, IncrementBackupHandler, args, reply)
	if err != nil {
		return err
	} else if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		return vearchpb.NewError(reply.Err.Code, nil)
	}
	return nil
}

// GetBackupStatus queries partition backup status
func GetBackupStatus(addr string, spaceKey string, backupID string, pid entity.PartitionID) (*entity.BackupStatusResponse, error) {
	query := &entity.BackupStatusQuery{
		SpaceKey: spaceKey,
		BackupID: backupID,
	}

	value, err := vjson.Marshal(query)
	if err != nil {
		return nil, err
	}

	log.Info("GetBackupStatus RPC call: addr=%s, spaceKey=%s, backupID=%s, pid=%d", addr, spaceKey, backupID, pid)
	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_GET}
	reply := new(vearchpb.PartitionData)
	err = Execute(addr, BackupStatusHandler, args, reply)
	if err != nil {
		log.Error("GetBackupStatus RPC error: %v", err)
		return nil, err
	}

	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		log.Error("GetBackupStatus RPC reply error code: %v", reply.Err.Code)
		return nil, vearchpb.NewError(reply.Err.Code, nil)
	}

	response := &entity.BackupStatusResponse{}
	if err := vjson.Unmarshal(reply.Data, response); err != nil {
		log.Error("GetBackupStatus unmarshal error: %v", err)
		return nil, err
	}

	log.Info("GetBackupStatus RPC success: exists=%v, status=%d, errorMsg=%s", response.Exists, response.Status, response.ErrorMessage)
	return response, nil
}

// DeleteBackupVersion deletes backup version (calls PS side to delete reference count)
func DeleteBackupVersion(addr string, spaceKey string, versionID string, pid entity.PartitionID) error {
	request := &entity.DeleteBackupVersionRequest{
		SpaceKey:  spaceKey,
		VersionID: versionID,
	}

	value, err := vjson.Marshal(request)
	if err != nil {
		return err
	}

	log.Info("DeleteBackupVersion RPC call: addr=%s, spaceKey=%s, versionID=%s, pid=%d", addr, spaceKey, versionID, pid)
	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_DELETE}
	reply := new(vearchpb.PartitionData)
	err = Execute(addr, DeleteBackupHandler, args, reply)
	if err != nil {
		log.Error("DeleteBackupVersion RPC error: %v", err)
		return err
	}

	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		log.Error("DeleteBackupVersion RPC reply error code: %v", reply.Err.Code)
		return vearchpb.NewError(reply.Err.Code, nil)
	}

	log.Info("DeleteBackupVersion RPC success: spaceKey=%s, versionID=%s", spaceKey, versionID)
	return nil
}

func ResourceLimit(addr string, resource *entity.ResourceLimit, pid entity.PartitionID) error {
	value, err := vjson.Marshal(resource)
	if err != nil {
		return err
	}

	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_CREATE}
	reply := new(vearchpb.PartitionData)
	err = Execute(addr, ResourceLimitHandler, args, reply)
	if err != nil {
		return err
	} else if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		return vearchpb.NewError(reply.Err.Code, nil)
	}

	return nil
}

func DeleteReplica(addr string, partitionId uint32) error {
	args := &vearchpb.PartitionData{PartitionID: partitionId}
	reply := new(vearchpb.PartitionData)
	err := Execute(addr, DeleteReplicaHandler, args, reply)
	if err != nil {
		return err
	} else if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		return vearchpb.NewError(reply.Err.Code, nil)
	}
	return nil
}

func DeletePartition(addr string, pid uint32) error {
	args := &vearchpb.PartitionData{PartitionID: pid}
	reply := new(vearchpb.PartitionData)
	err := Execute(addr, DeletePartitionHandler, args, reply)
	if err != nil {
		return err
	} else if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
		return vearchpb.NewError(reply.Err.Code, nil)
	}
	return nil
}

func ServerS
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #514** (2021-11-05): **PS k8s 部署使用挂载盘，重启后索引数据未重新加载**
  *Symptoms*: PS 节点是通过K8s启动，PVC挂载了一个云盘，之前试过少量数据重启后能够重新加载回索引，但这次是单节点3600万数据挂掉之后重启没有恢复数据，partition数量减1； IVFPQ v3.2.7最新 建表参数 <img width="390" alt="image" src="https://user-images.githubusercontent.com/42227773/134772941-99e45c60-70da-4be0-96fa-83893af911fb.png">  master节点log <img width="1915" alt="image" src="https://user-images.githubusercontent.com/42227773/134773087-5c87af99-6196-44a2-95fb-7bd99e54dc62.png">  重启PS.INFO.log <img width="961" alt="image" src="https://user-images.githubusercontent.com/42227773/134772987-c36fb28b-e32e-4e52-a0c1-59999bf54686.png">  重启gamma log： <img width="1388" alt="image" src="https://user-images.githubusercontent.com/42227773/134773104-40e8025b-e9e0-4ba8-aba8-f0b74e9d9773.png">   监控 <img width="789" alt="image" src="https://user-images.githubusercontent.com/42227773/134773120-a12c4a42-cdcc-4900-84f8-b6764c4918c3.png">  重启PS节点的datas <img width="847" alt="image" src="https://user-images.githubusercontent.com/42227773/134773154-05162199-b39e-4240-a73e-ab4b34534b5f.png">  正常未重启PS节点的datas <img width="885" alt="image" src="https://user-images.githubusercontent.com/42227773/134773173-abfa5fdc-9e7c-4f57-9893-d18396f2f450.png">  通过datas比较，我认为挂载盘是没有问题的。  执行flash出现如下错误 <img width="1191" alt="image" src="https://user-images.githubusercontent.com/42227773/134773234-9ba87c34-25f8-4a21-9aad-42f0230528cf.png">   
  **Post-Mortem & Fix Analysis**:
  > 用的vearch哪个版本呢？
  > > 用的vearch哪个版本呢？  v3.2.7最新
  > 可以提供一下health接口返回的参数吗？

- **Issue #88** (2021-04-30): **查询结果不准确**
  *Symptoms*: 我用的测试集大小大概是358万条64维向量， create space 参数如下： ``` {     "name": "test_space",     "partition_num": 3,     "replica_num": 1,     "engine": {         "name": "gamma",         "index_size": 100,         "max_size": 10000000,         "nprobe": 256,         "metric_type": "InnerProduct",         "ncentroids": 16384,         "nsubvector": 32     },     "properties": {         "str": {             "type": "keyword",             "index": "true"         },         "num": {             "type": "integer",             "index": "true"         },         "score": {             "type": "float",             "index": "true"         },         "tags": {             "type": "string",             "array": true,             "index": "true"         },         "nums": {             "type": "integer",             "array": false,             "index": "true"         },         "vec": {             "type": "vector",             "dimension": 64,             "store_type": "Mmap",             "store_param": {                 "cache_size": 2000             }         }     } } ```  数据插入方式批量插入，每10000条插入一次，  查询参数如下： ``` {     "query": {         "sum": [             {                 "field": "vec",                 "feature": [                     -0.5279306,                     0.013351947,                     -0.19579811,                     0.057762206,                     -0.34226078,                     0.14666641,                     -0.34158
  **Post-Mortem & Fix Analysis**:
  > @Silocean 搜索时按分数过滤返回结果，如果只设置min_score或max_score确实有点小问题，我们会在后面的版本fix。你可以试试同时设置它们，比如设置"min_score": 0.8，"max_score": 1.0，或者都不设置。

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `f980caf9` (2026-07-20)
**Commit Message**: fix: replace busy-wait with blocking select in router search (#884)

**File**: `internal/client/client.go` (modified, +24/-25)
```diff
@@ -109,7 +109,7 @@ const (
 
 // NewRouterRequest create a new request for router
 func NewRouterRequest(ctx context.Context, client *Client) *routerRequest {
-	return &routerRequest{ctx: ctx, client: client, md: make(map[string]string)}
+	return &routerRequest{ctx: ctx, client: client, md: make(map[string]string), errNotify: make(chan struct{})}
 }
 
 type routerRequest struct {
@@ -123,6 +123,9 @@ type routerRequest struct {
 	clientMap sync.Map
 	// Err if error else nil
 	Err error
+
+	errOnce   sync.Once
+	errNotify chan struct{}
 }
 
 // GetMD
@@ -147,6 +150,10 @@ func (r *routerRequest) GetMsgID() string {
 	return msgID
 }
 
+func (r *routerRequest) signalErr() {
+	r.errOnce.Do(func() { close(r.errNotify) })
+}
+
 // SetMethod set method
 func (r *routerRequest) SetMethod(method string) *routerRequest {
 	r.md[HandlerType] = method
@@ -696,6 +703,7 @@ func (r *routerRequest) searchFromPartition(ctx context.Context, partitionID ent
 	if r.Err == nil {
 		if searchResponse != nil && searchResponse.Head != nil && searchResponse.Head.Err != nil && searchResponse.Head.Err.GetCode() == vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED {
 			r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+			r.signalErr()
 			replyPartition.Err = searchResponse.Head.Err
 		} else if searchResponse != nil {
 			if trace {
@@ -718,6 +726,7 @@ func (r *routerRequest) searchFromPartition(ctx context.Context, partitionID ent
 			flatBytes := searchResponse.FlatBytes
 			if entity.CheckVirtualMemExceed(len(flatBytes)) {
 				r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+				r.signalErr()
 				replyPartition.Err = &vearchpb.Error{Code: vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, Msg: "request canceled"}
 			} else if flatBytes != nil {
 				deSerializeStartTime := time.Now()
@@ -915,19 +924,13 @@ func (r *routerRequest) SearchFieldSortExecute(desc bool) *vearchpb.SearchRespon
 		}
 	}()
 
-	canceled := false
-	for {
-		select {
-		case <-doneCh:
-			return searchResponse
-		default:
-		}
-
-		if r.Err != nil && !canceled {
-			r.CancelRequestFromPartition()
-			canceled = true
-		}
+	select {
+	case <-doneCh:
+	case <-r.errNotify:
+		r.CancelRequestFromPartition()
+		<-doneCh
 	}
+	return searchResponse
 }
 
 func (r *routerRequest) queryFromPartition(ctx context.Context, partitionID entity.PartitionID, pd *vearchpb.PartitionData, space *entity.Space, respChain chan *response.SearchDocResult) {
@@ -1038,12 +1041,14 @@ func (r *routerRequest) queryFromPartition(ctx context.Context, partitionID enti
 		searchResponse := replyPartition.SearchResponse
 		if searchResponse != nil && searchResponse.Head.Err != nil && searchResponse.Head.Err.GetCode() == vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED {
 			r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+			r.signalErr()
 			replyPartition.Err = searchResponse.Head.Err
 		}
 		if searchResponse != nil {
 			flatBytes := searchResponse.FlatBytes
 			if entity.CheckVirtualMemExceed(len(flatBytes)) {
 				r.Err = vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, errors.New("request canceled"))
+				r.signalErr()
 				replyPartition.Err = &vearchpb.Error{Code: vearchpb.ErrorEnum_PARTITION_SERVER_MEMORYEXCEED, Msg: "request canceled"}
 			} else if flatBytes != nil {
 				gamma.DeSerialize(flatBytes, searchResponse)
@@ -1168,19 +1173,13 @@ func (r *routerRequest) QueryFieldSortExecute() *vearchpb.SearchResponse {
 		}
 	}()
 
-	canceled := false
-	for {
-		select {
-		case <-doneCh:
-			return searchResponse
-		default:
-		}
-
-		if r.Err != nil && !canceled {
-			r.CancelRequestFromPartition()
-			canceled = true
-		}
+	select {
+	case <-doneCh:
+	case <-r.errNotify:
+		r.CancelRequestFromPartition()
+		<-doneCh
 	}
+	return searchResponse
 }
 
 func setDocs(keys []string) (docs []*vearchpb.Document, err
```

---

### Incident Patch 2: `287af30d` (2026-07-19)
**Commit Message**: fix: replace buggy quickSort with sort.Slice in search result merge (#883)

**File**: `internal/client/client.go` (modified, +6/-38)
```diff
@@ -869,7 +869,12 @@ func (r *routerRequest) SearchFieldSortExecute(desc bool) *vearchpb.SearchRespon
 			}
 
 			for _, resp := range result {
-				quickSort(resp.ResultItems, desc, 0, len(resp.ResultItems)-1)
+				sort.Slice(resp.ResultItems, func(i, j int) bool {
+					if desc {
+						return resp.ResultItems[i].Score > resp.ResultItems[j].Score
+					}
+					return resp.ResultItems[i].Score < resp.ResultItems[j].Score
+				})
 				if len(resp.ResultItems) > 0 {
 					if searchReq.PageSize > 0 && searchReq.PageNum >= 1 {
 						start := searchReq.PageSize * (searchReq.PageNum - 1)
@@ -1178,43 +1183,6 @@ func (r *routerRequest) QueryFieldSortExecute() *vearchpb.SearchResponse {
 	}
 }
 
-func quickSort(items []*vearchpb.ResultItem, desc bool, low, high int) {
-	if low < high {
-		var pivot = partition(items, desc, low, high)
-		quickSort(items, desc, low, pivot)
-		quickSort(items, desc, pivot+1, high)
-	}
-}
-
-func partition(items []*vearchpb.ResultItem, desc bool, low, high int) int {
-	var pivot = items[low]
-	var i = low
-	var j = high
-	for i < j {
-		if desc {
-			for j > low && items[j].Score <= pivot.Score {
-				j--
-			}
-			for i < high && items[i].Score > pivot.Score {
-				i++
-			}
-		} else {
-			for j > low && items[j].Score >= pivot.Score {
-				j--
-			}
-			for i < high && items[i].Score < pivot.Score {
-				i++
-			}
-		}
-		if i < j {
-			items[i], items[j] = items[j], items[i]
-		}
-	}
-
-	items[low], items[j] = items[j], pivot
-	return j
-}
-
 func setDocs(keys []string) (docs []*vearchpb.Document, err error) {
 	docs = make([]*vearchpb.Document, 0)
 	for _, key := range keys {
```

---

### Incident Patch 3: `d1acd641` (2026-06-05)
**Commit Message**: fix: fix memory leak in response (#874)

**File**: `internal/engine/c_api/api_data/response.cc` (modified, +21/-16)
```diff
@@ -53,18 +53,20 @@ int Response::Serialize(const std::string &space_name,
   vearchpb::SearchResponse pbResponse;
   pbResponse.set_timeout(false);
 
-  std::string serialized;
-  if (!pbResponse.SerializeToString(&serialized)) {
-    LOG(ERROR) << "failed to serialize " << serialized.size();
-    return -1;
-  }
-  
-  *out_len = serialized.size();
-  *out = (char *)malloc(*out_len * sizeof(char));
-  memcpy(*out, (char *)serialized.data(), *out_len);
-
   // empty result
   if (table == nullptr || vector_mgr == nullptr) {
+    std::string serialized;
+    if (!pbResponse.SerializeToString(&serialized)) {
+      LOG(ERROR) << "failed to serialize empty result";
+      return -1;
+    }
+    *out_len = serialized.size();
+    *out = (char *)malloc(*out_len * sizeof(char));
+    if (*out == nullptr) {
+      LOG(ERROR) << "failed to allocate memory for response";
+      return -1;
+    }
+    memcpy(*out, serialized.data(), *out_len * sizeof(char));
     return 0;
   }
   const auto &attr_idx_map = table->FieldMap();
@@ -161,24 +163,27 @@ int Response::Serialize(const std::string &space_name,
     pbRes->set_timeout(false);
   }
 
+  std::string serialized;
   if (!pbResponse.SerializeToString(&serialized)) {
-    LOG(ERROR) << "failed to serialize " << serialized;
+    LOG(ERROR) << "failed to serialize results";
     return -1;
   }
   *out_len = serialized.size();
   *out = (char *)malloc(*out_len * sizeof(char));
-  memcpy(*out, (char *)serialized.data(), *out_len);
-  delete[] gamma_results_;
-  gamma_results_ = nullptr;
+  if (*out == nullptr) {
+    LOG(ERROR) << "failed to allocate memory for response";
+    return -1;
+  }
+  memcpy(*out, serialized.data(), *out_len * sizeof(char));
   if (perf_tool_) {
     PerfTool *perf_tool = static_cast<PerfTool *>(perf_tool_);
     perf_tool->Perf("serialize");
     if (perf_tool->Cost() > perf_tool->slow_search_time) {
       LOG(WARNING) << space_name << " " << request_id_ << " "
-                   << perf_tool->OutputPerf().str();
+                  << perf_tool->OutputPerf().str();
     } else {
       LOG(TRACE) << space_name << " " << request_id_ << " "
-                 << perf_tool->OutputPerf().str();
+                << perf_tool->OutputPerf().str();
     }
   }
   return 0;
```

---

### Incident Patch 4: `8f49c238` (2026-04-14)
**Commit Message**: fix: ivfrabitq use the default metric_type for searching

**File**: `internal/engine/index/impl/gamma_index_ivfrabitq.cc` (modified, +0/-8)
```diff
@@ -619,14 +619,6 @@ void GammaIVFRABITQIndex::search_preassigned(RetrievalContext *retrieval_context
     del_params.set(retrieval_params);
   }
 
-  faiss::MetricType metric_type;
-  if (retrieval_params->GetDistanceComputeType() ==
-      DistanceComputeType::INNER_PRODUCT) {
-    metric_type = faiss::METRIC_INNER_PRODUCT;
-  } else {
-    metric_type = faiss::METRIC_L2;
-  }
-
   long max_codes = 1000000000;
   size_t ndis = 0;
 
```

---

### Incident Patch 5: `12ba13f6` (2026-03-02)
**Commit Message**: fix: remove httpReply for unsupported operation (#866)

* fix: add more information for master response message

* fix: remove httpReply for unsupported operation

* add test case

---------

Co-authored-by: yanwenru1 <yanwenru1@jd.com>

**File**: `internal/master/cluster_api.go` (modified, +3/-11)
```diff
@@ -198,16 +198,6 @@ func TimeoutMiddleware(defaultTimeout time.Duration) gin.HandlerFunc {
 				}
 			}
 
-			if httpResp == nil {
-				httpReply := &response.HttpReply{
-					Code:      int(vearchpb.ErrorEnum_INTERNAL_ERROR),
-					RequestId: c.GetHeader(paramRequestID),
-					Msg:       "get response data error",
-				}
-				httpResp = &response.Response{}
-				httpResp.SetHttpReply(httpReply)
-				httpResp.SetHttpStatus(http.StatusInternalServerError)
-			}
 			resultCh <- httpResp
 		}()
 
@@ -220,7 +210,9 @@ func TimeoutMiddleware(defaultTimeout time.Duration) gin.HandlerFunc {
 					"msg":        "request timeout"})
 			c.Abort()
 		case res := <-resultCh:
-			c.JSON(int(res.GetHttpStatus()), res.GetHttpReply())
+			if res != nil {
+				c.JSON(int(res.GetHttpStatus()), res.GetHttpReply())
+			}
 		}
 	}
 }
```

**File**: `test/test_document_upsert.py` (modified, +3/-1)
```diff
@@ -242,10 +242,12 @@ def test_prepare_cluster_badcase(self):
             [11, "wrong_vector_feature_type"],
             [12, "mismatch_field_type"],
             [13, "wrong partition id"],
+            [14, "upsert_with_master_url"],
+            [15, "wrong_url_path"],
         ],
     )
     def test_vearch_document_upsert_badcase(self, index, wrong_type):
-        wrong_parameters = [False for i in range(14)]
+        wrong_parameters = [False for i in range(16)]
         wrong_parameters[index] = True
         batch_size = 1
         total = 1
```

**File**: `test/utils/vearch_utils.py` (modified, +15/-6)
```diff
@@ -26,6 +26,7 @@
 import datetime
 
 router_url = os.getenv("ROUTER_URL", "http://127.0.0.1:9001")
+master_url = os.getenv("MASTER_URL", "http://127.0.0.1:8817")
 db_name = "ts_db"
 space_name = "ts_space"
 username = "root"
@@ -348,13 +349,19 @@ def process_add_error_data(items):
     wrong_vector_feature_type = items[3][11]
     mismatch_field_type = items[3][12]
     wrong_partition_id = items[3][13]
+    upsert_with_master_url = items[3][14]
+    wrong_url_path = items[3][15]
     max_index_str_length = 1025
     max_str_length = 65536
 
     if wrong_db:
         data["db_name"] = "wrong_db"
     if wrong_space:
         data["space_name"] = "wrong_space"
+    if upsert_with_master_url:
+        url = master_url + "/document/upsert"
+    if wrong_url_path:
+        url = router_url + "/document/insert"
     for j in range(batch_size):
         param_dict = {}
         param_dict["field_int"] = index * batch_size + j
@@ -410,13 +417,15 @@ def process_add_error_data(items):
 
     if not wrong_string_length:
         logger.info(json_str)
-    logger.info(rs.json())
-
-    if "data" in rs.json():
-        for result in rs.json()["data"]["document_ids"]:
-            assert result["code"] != 0
+    if upsert_with_master_url or wrong_url_path:
+        assert rs.status_code == 404
     else:
-        assert rs.status_code != 200
+        logger.info(rs.json())
+        if "data" in rs.json():
+            for result in rs.json()["data"]["document_ids"]:
+                assert result["code"] != 0
+        else:
+            assert rs.status_code != 200
 
 
 def process_add_mul_error_data(items):
```

---

### Incident Patch 6: `ff3737a6` (2026-02-04)
**Commit Message**: fix: fix physical backup (#863)

* fix: fix physical backup in vearch

* fix: Extract constants and modify naming logic

---------

Co-authored-by: anpeihang.1 <anpeihang.1@jd.com>

**File**: `.github/workflows/CI_cluster_master.yml` (modified, +28/-0)
```diff
@@ -189,6 +189,34 @@ jobs:
         pytest test_cluster_master.py -x -k "TestClusterMasterOperate" --log-cli-level=INFO
         pytest test_vearch.py -x -k "test_vearch_basic_usage" --log-cli-level=INFO
 
+    - name: Run cluster backup and restore tests
+      run: |
+        mkdir -p test/oss_data
+        docker run -d --name minio -p 10000:9000 --network vearch_network_cluster minio/minio server test/oss_data
+        wget -q https://dl.min.io/client/mc/release/linux-amd64/mc
+        chmod +x mc
+        retry=0
+        max_retries=10
+        until ./mc alias set myminio http://127.0.0.1:10000 minioadmin minioadmin; do
+          retry=$((retry+1))
+          if [ $retry -gt $max_retries ]; then
+            echo "Failed to set minio alias after $max_retries attempts."
+            exit 1
+          fi
+          echo "Retry $retry/$max_retries: Failed to set minio alias. Retrying in 5 seconds..."
+          sleep 5
+        done
+        ./mc mb myminio/test || true
+        
+        # Run cluster backup and restore tests
+        cd test
+        pytest test_cluster_backup.py -x --log-cli-level=INFO
+        
+        # Cleanup minio
+        cd ..
+        docker stop minio || true
+        docker rm minio || true
+
     - name: Clean cluster
       run: |
         docker-compose -f cloud/docker-compose.yml --profile cluster stop
```

**File**: `internal/client/ps.go` (modified, +3/-0)
```diff
@@ -63,6 +63,9 @@ const (
 	RebuildIndexHandler           = "RebuildIndexHandler"
 	FlushHandler                  = "FlushHandler"
 	BackupHandler                 = "BackupHandler"
+	IncrementBackupHandler        = "IncrementBackupHandler"
+	BackupStatusHandler           = "BackupStatusHandler"
+	DeleteBackupHandler           = "DeleteBackupHandler"
 	ResourceLimitHandler          = "ResourceLimitHandler"
 
 	CreatePartitionHandler = "CreatePartitionHandler"
```

**File**: `internal/client/ps_admin_service.go` (modified, +83/-0)
```diff
@@ -107,6 +107,89 @@ func BackupSpace(addr string, backup *entity.BackupSpaceRequest, pid entity.Part
 	return nil
 }
 
+func OperateBackupOrRestore(addr string, backup *entity.BackupOrRestoreRequest, pid entity.PartitionID) error {
+	value, err := vjson.Marshal(backup)
+	if err != nil {
+		return err
+	}
+
+	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_CREATE}
+	reply := new(vearchpb.PartitionData)
+	err = Execute(addr, IncrementBackupHandler, args, reply)
+	if err != nil {
+		return err
+	} else if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
+		return vearchpb.NewError(reply.Err.Code, nil)
+	}
+	return nil
+}
+
+// GetBackupStatus queries partition backup status
+func GetBackupStatus(addr string, spaceKey string, backupID string, pid entity.PartitionID) (*entity.BackupStatusResponse, error) {
+	query := &entity.BackupStatusQuery{
+		SpaceKey: spaceKey,
+		BackupID: backupID,
+	}
+
+	value, err := vjson.Marshal(query)
+	if err != nil {
+		return nil, err
+	}
+
+	log.Info("GetBackupStatus RPC call: addr=%s, spaceKey=%s, backupID=%s, pid=%d", addr, spaceKey, backupID, pid)
+	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_GET}
+	reply := new(vearchpb.PartitionData)
+	err = Execute(addr, BackupStatusHandler, args, reply)
+	if err != nil {
+		log.Error("GetBackupStatus RPC error: %v", err)
+		return nil, err
+	}
+
+	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
+		log.Error("GetBackupStatus RPC reply error code: %v", reply.Err.Code)
+		return nil, vearchpb.NewError(reply.Err.Code, nil)
+	}
+
+	response := &entity.BackupStatusResponse{}
+	if err := vjson.Unmarshal(reply.Data, response); err != nil {
+		log.Error("GetBackupStatus unmarshal error: %v", err)
+		return nil, err
+	}
+
+	log.Info("GetBackupStatus RPC success: exists=%v, status=%d, errorMsg=%s", response.Exists, response.Status, response.ErrorMessage)
+	return response, nil
+}
+
+// DeleteBackupVersion deletes backup version (calls PS side to delete reference count)
+func DeleteBackupVersion(addr string, spaceKey string, versionID string, pid entity.PartitionID) error {
+	request := &entity.DeleteBackupVersionRequest{
+		SpaceKey:  spaceKey,
+		VersionID: versionID,
+	}
+
+	value, err := vjson.Marshal(request)
+	if err != nil {
+		return err
+	}
+
+	log.Info("DeleteBackupVersion RPC call: addr=%s, spaceKey=%s, versionID=%s, pid=%d", addr, spaceKey, versionID, pid)
+	args := &vearchpb.PartitionData{PartitionID: pid, Data: value, Type: vearchpb.OpType_DELETE}
+	reply := new(vearchpb.PartitionData)
+	err = Execute(addr, DeleteBackupHandler, args, reply)
+	if err != nil {
+		log.Error("DeleteBackupVersion RPC error: %v", err)
+		return err
+	}
+
+	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
+		log.Error("DeleteBackupVersion RPC reply error code: %v", reply.Err.Code)
+		return vearchpb.NewError(reply.Err.Code, nil)
+	}
+
+	log.Info("DeleteBackupVersion RPC success: spaceKey=%s, versionID=%s", spaceKey, versionID)
+	return nil
+}
+
 func ResourceLimit(addr string, resource *entity.ResourceLimit, pid entity.PartitionID) error {
 	value, err := vjson.Marshal(resource)
 	if err != nil {
```

**File**: `internal/entity/backup.go` (added, +164/-0)
```diff
@@ -0,0 +1,164 @@
+// Copyright 2019 The Vearch Authors.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
+// implied. See the License for the specific language governing
+// permissions and limitations under the License.
+
+package entity
+
+import "time"
+
+// BackupSpaceRequest backup space request
+type BackupSpaceRequest struct {
+	Command           string      `json:"command,omitempty"`
+	BackupID          int         `json:"backup_id,omitempty"`
+	VersionID         string      `json:"version_id,omitempty"`
+	BackupType        string      `json:"backup_type,omitempty"` // Backup type: "full" for full backup, "incremental" for incremental backup (default: full)
+	Part              PartitionID `json:"part"`
+	SourceClusterName string      `json:"source_cluster_name,omitempty"` // Source cluster name (for cross-cluster restore)
+	S3Param           struct {
+		Region     string `json:"region"`
+		BucketName string `json:"bucket_name"`
+		EndPoint   string `json:"endpoint"`
+		AccessKey  string `json:"access_key"`
+		SecretKey  string `json:"secret_key"`
+		UseSSL     bool   `json:"use_ssl"`
+	} `json:"s3_param,omitempty"`
+}
+
+// BackupOrRestoreRequest backup or restore request
+type BackupOrRestoreRequest struct {
+	Database          string `json:"database"`
+	Space             string `json:"space"`
+	BackupID          string `json:"backup_id"`
+	VersionID         string `json:"version_id"`
+	Command           string `json:"command,omitempty"`
+	BackupType        string `json:"backup_type,omitempty"`         // Backup type: "full" for full backup, "incremental" for incremental backup (default: incremental)
+	S3PartitionID     uint32 `json:"s3_partition_id,omitempty"`     // Partition ID on S3 (used during restore when new partition ID differs from S3 partition ID)
+	SourceClusterName string `json:"source_cluster_name,omitempty"` // Source cluster name (for cross-cluster restore)
+	S3Param           struct {
+		Region     string `json:"region"`
+		BucketName string `json:"bucket_name"`
+		EndPoint   string `json:"endpoint"`
+		AccessKey  string `json:"access_key"`
+		SecretKey  string `json:"secret_key"`
+		UseSSL     bool   `json:"use_ssl"`
+	} `json:"s3_param,omitempty"`
+}
+
+// BackupSpaceResponse backup space response
+type BackupSpaceResponse struct {
+	BackupID  int    `json:"backup_id,omitempty"`
+	BackupIDs []int  `json:"backup_ids,omitempty"`
+	VersionID string `json:"version_id,omitempty"`
+}
+
+// BackupProgressResponse backup progress response
+type BackupProgressResponse struct {
+	TotalTasks     int     `json:"total_tasks,omitempty"`     // Total number of tasks
+	CompletedTasks int     `json:"completed_tasks,omitempty"` // Number of completed tasks
+	SuccessRatio   float64 `json:"success_ratio,omitempty"`   // Success ratio of partitions (0.0-1.0)
+	Status         string  `json:"status,omitempty"`          // Backup status: completed, failed, running
+	VersionID      string  `json:"version_id,omitempty"`      // Version ID
+}
+
+// BackupStatusQuery backup status query
+type BackupStatusQuery struct {
+	SpaceKey string `json:"space_key"`
+	BackupID string `json:"backup_id"`
+}
+
+// BackupStatusResponse backup status response
+type BackupStatusResponse struct {
+	Exists       bool   `json:"exists"`
+	Status       int    `json:"status"` // 0=running, 1=completed, 2=failed
+	ErrorMessage string `json:"error_message"`
+}
+
+// DeleteBackupVersionRequest delete backup version request
+type DeleteBackupVersionRequest struct {
+	SpaceKey  string `json:"space_key"`
+	VersionID string `json:"version_id"`
+}
+
+// Backu
```

**File**: `internal/entity/space.go` (modified, +0/-19)
```diff
@@ -129,25 +129,6 @@ type SpaceInfo struct {
 	Errors        []string         `json:"errors,omitempty"`
 }
 
-type BackupSpaceRequest struct {
-	Command  string      `json:"command,omitempty"`
-	BackupID int         `json:"backup_id,omitempty"`
-	Part     PartitionID `json:"part"`
-	S3Param  struct {
-		Region     string `json:"region"`
-		BucketName string `json:"bucket_name"`
-		EndPoint   string `json:"endpoint"`
-		AccessKey  string `json:"access_key"`
-		SecretKey  string `json:"secret_key"`
-		UseSSL     bool   `json:"use_ssl"`
-	} `json:"s3_param,omitempty"`
-}
-
-type BackupSpaceResponse struct {
-	BackupID  int   `json:"backup_id,omitempty"`
-	BackupIDs []int `json:"backup_ids,omitempty"`
-}
-
 type SpaceProperties struct {
 	FieldType  vearchpb.FieldType   `json:"field_type"`
 	Type       string               `json:"type"`
```

---

### Incident Patch 7: `a2c66657` (2026-01-31)
**Commit Message**: fix: check valid segment for memory buffer when updating and loading (#862)

* perf: remove useless prometheus metrics

* fix: check valid segment for memory buffer when updating and loading

**File**: `internal/client/master_cache.go` (modified, +6/-6)
```diff
@@ -104,7 +104,7 @@ func cachePartitionKey(space string, pid entity.PartitionID) string {
 	return space + "/" + strconv.FormatInt(int64(pid), 10)
 }
 
-func cacheSpaceKey(db, space string) string {
+func CacheSpaceKey(db, space string) string {
 	return db + "/" + space
 }
 
@@ -211,7 +211,7 @@ func (cliCache *clientCache) reloadRoleCache(ctx context.Context, sync bool, rol
 
 // find a space by db and space name, if not exist so query it from etcd
 func (cliCache *clientCache) SpaceByCache(ctx context.Context, db, space string) (*entity.Space, error) {
-	key := cacheSpaceKey(db, space)
+	key := CacheSpaceKey(db, space)
 
 	get, found := cliCache.spaceCache.Get(key)
 	if found {
@@ -236,7 +236,7 @@ func (cliCache *clientCache) SpaceByCache(ctx context.Context, db, space string)
 }
 
 func (cliCache *clientCache) reloadSpaceCache(ctx context.Context, sync bool, db string, spaceName string) error {
-	key := cacheSpaceKey(db, spaceName)
+	key := CacheSpaceKey(db, spaceName)
 
 	fun := func() error {
 		log.Info("to reload db:[%s] space:[%s]", db, spaceName)
@@ -467,7 +467,7 @@ func (cliCache *clientCache) startCacheJob(ctx context.Context) error {
 			if err != nil {
 				return vearchpb.NewError(vearchpb.ErrorEnum_PARAM_ERROR, fmt.Errorf("find db by id err: %s, data: %s", err.Error(), string(value)))
 			}
-			ckey := cacheSpaceKey(dbName, space.Name)
+			ckey := CacheSpaceKey(dbName, space.Name)
 			if oldValue, b := cliCache.spaceCache.Get(ckey); !b || space.Version > oldValue.(*entity.Space).Version {
 				spaceCacheLock.Lock()
 				cliCache.spaceCache.Set(ckey, space, cache.NoExpiration)
@@ -788,7 +788,7 @@ func (cliCache *clientCache) initSpace(ctx context.Context) error {
 		}
 
 		spaceCacheLock.Lock()
-		if err := cliCache.spaceCache.Add(cacheSpaceKey(db, s.Name), s, cache.NoExpiration); err != nil {
+		if err := cliCache.spaceCache.Add(CacheSpaceKey(db, s.Name), s, cache.NoExpiration); err != nil {
 			log.Error(err.Error())
 		} else {
 			cliCache.spaceIDCache.Set(cast.ToString(s.Id), s, cache.NoExpiration)
@@ -902,7 +902,7 @@ func (cliCache *clientCache) initRouter(ctx context.Context) error {
 
 func (cliCache *clientCache) DeleteSpaceCache(ctx context.Context, db, space string) {
 	spaceCacheLock.Lock()
-	cliCache.spaceCache.Delete(cacheSpaceKey(db, space))
+	cliCache.spaceCache.Delete(CacheSpaceKey(db, space))
 	spaceCacheLock.Unlock()
 }
 
```

**File**: `internal/client/ps_admin_service.go` (modified, +8/-1)
```diff
@@ -15,6 +15,7 @@
 package client
 
 import (
+	"fmt"
 	"strings"
 
 	"github.com/vearch/vearch/v3/internal/entity"
@@ -181,6 +182,9 @@ func PartitionInfo(addr string, pid entity.PartitionID, detail_info bool) (value
 	if err != nil {
 		return nil, err
 	}
+	if len(infos) == 0 {
+		return nil, vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_NOT_EXIST, fmt.Errorf("get partitionID: [%d] infos is nil", pid))
+	}
 	return infos[0], nil
 }
 
@@ -206,11 +210,14 @@ func _partitionsInfo(addr string, pid entity.PartitionID, detail_info bool) (val
 	if reply.Err.Code != vearchpb.ErrorEnum_SUCCESS {
 		return nil, vearchpb.NewError(reply.Err.Code, nil)
 	}
+	if reply.Data == nil {
+		return nil, vearchpb.NewError(vearchpb.ErrorEnum_PARTITION_NOT_EXIST, fmt.Errorf("get partitionID: [%d] reply data is nil", pid))
+	}
 	value = make([]*entity.PartitionInfo, 0, 1)
 	err = vjson.Unmarshal(reply.Data, &value)
 	if err != nil {
 		log.Error("Unmarshal partition info failed, err: [%v]", err)
-		return
+		return nil, err
 	}
 	return value, nil
 }
```

**File**: `internal/engine/common/gamma_common_data.h` (modified, +2/-1)
```diff
@@ -24,8 +24,9 @@ const float GAMMA_INDEX_RECALL_RATIO = 1.0f;
 const int min_points_per_centroid = 39;
 const int default_points_per_centroid = 200;
 const int max_points_per_centroid = 256;
-const int defautMemoryBufferSegmentSize = 100000;
+const int DEFAULT_MEMORY_BUFFER_SEGMENT_SIZE = 100000;
 const int brute_force_search_threshold = 100;
+const int ADD_COUNT_THRESHOLD = 100000;
 
 enum class VectorStorageType : std::uint8_t { MemoryOnly, MemoryBuffer, RocksDB };
 
```

**File**: `internal/engine/index/impl/gamma_index_ivfflat.cc` (modified, +1/-1)
```diff
@@ -397,7 +397,7 @@ bool GammaIVFFlatIndex::Add(int n, const uint8_t *vec) {
   indexed_vec_count_ += n;
 #ifdef PERFORMANCE_TESTING
   add_count_ += n;
-  if (add_count_ >= 10000) {
+  if (add_count_ >= ADD_COUNT_THRESHOLD) {
     double t1 = faiss::getmillisecs();
     LOG(DEBUG) << "Add time [" << (t1 - t0) / n << "]ms, count "
                << indexed_vec_count_ << " wanted n=" << n
```

**File**: `internal/engine/index/impl/gamma_index_ivfpq.cc` (modified, +1/-1)
```diff
@@ -496,7 +496,7 @@ bool GammaIVFPQIndex::Add(int n, const uint8_t *vec) {
   indexed_vec_count_ += n;
 #ifdef PERFORMANCE_TESTING
   add_count_ += n;
-  if (add_count_ >= 10000) {
+  if (add_count_ >= ADD_COUNT_THRESHOLD) {
     double t1 = faiss::getmillisecs();
     LOG(DEBUG) << "Add time [" << (t1 - t0) / n << "]ms, count "
                << indexed_vec_count_ << ", wanted n=" << n
```

---

### Incident Patch 8: `f3255b3b` (2026-01-30)
**Commit Message**: fix: set value for httpRes and add default value for config (#860)

Co-authored-by: yanwenru1 <yanwenru1@jd.com>

**File**: `internal/entity/config.go` (modified, +2/-3)
```diff
@@ -62,8 +62,8 @@ var (
 
 var ConfigInfo = &Config{
 	RouterCount:        0.0,
-	RequestLimitConfig: &RequestLimitCfg{},
-	MemoryLimitConfig:  &MemoryLimitCfg{},
+	RequestLimitConfig: &RequestLimitCfg{true, DefaultReadRequestLimitCount, DefaultWriteRequestLimitCount},
+	MemoryLimitConfig:  &MemoryLimitCfg{true, DefaultRouterMemoryLimitPercent, DefaultPsMemoryLimitPercent},
 }
 
 func SetRequestLimit(requestLimit *RequestLimitCfg) {
@@ -78,7 +78,6 @@ func SetRequestLimit(requestLimit *RequestLimitCfg) {
 
 		if requestLimit.TotalWriteLimit > 0 {
 			ConfigInfo.RequestLimitConfig.TotalWriteLimit = requestLimit.TotalWriteLimit
-
 		} else {
 			ConfigInfo.RequestLimitConfig.TotalWriteLimit = DefaultWriteRequestLimitCount
 		}
```

**File**: `internal/master/cluster_api.go` (modified, +3/-3)
```diff
@@ -201,9 +201,9 @@ func TimeoutMiddleware(defaultTimeout time.Duration) gin.HandlerFunc {
 					RequestId: c.GetHeader(paramRequestID),
 					Msg:       "get response data error",
 				}
-				res := &response.Response{}
-				res.SetHttpReply(httpReply)
-				res.SetHttpStatus(http.StatusInternalServerError)
+				httpResp = &response.Response{}
+				httpResp.SetHttpReply(httpReply)
+				httpResp.SetHttpStatus(http.StatusInternalServerError)
 			}
 			resultCh <- httpResp
 		}()
```

---

### Incident Patch 9: `8dc4fb9c` (2026-01-08)
**Commit Message**: fix: check partition leader before register to master (#859)

* fix: check partition leader before register to master

* add error message check info

**File**: `.github/workflows/CI_cluster_ps.yml` (modified, +1/-1)
```diff
@@ -126,7 +126,7 @@ jobs:
           echo "Status is red."
         fi
         sleep 30
-        errors=$(curl -s -L -u root:secret http://127.0.0.1:8817/cluster/health?detail=true\&timeout=1000000 | jq -r '.data[0].spaces[].errors[] | select(contains("leader"))')
+        errors=$(curl -s -L -u root:secret http://127.0.0.1:8817/cluster/health?detail=true\&timeout=1000000 | jq -r '.data[0].spaces[].errors[] | select(contains("leader") or contains("call_rpcclient_failed"))')
         if [ -z "$errors" ]; then
           echo "Error: errors is $errors."
           exit 1
```

**File**: `internal/ps/server.go` (modified, +5/-0)
```diff
@@ -316,6 +316,11 @@ func (s *Server) registerMaster(leader entity.NodeID, pid entity.PartitionID) {
 		return
 	}
 
+	if !s.raftServer.IsLeader(uint64(pid)) {
+		log.Debug("server %d is not leader of partition: [%d]", s.nodeID, pid)
+		return
+	}
+
 	partition := store.(PartitionStore).GetPartition()
 	partition.LeaderID = s.nodeID
 
```

---

### Incident Patch 10: `097c6a7f` (2025-12-31)
**Commit Message**: fix: raft server can't get node replica info (#858)

**File**: `internal/ps/partition_service.go` (modified, +9/-0)
```diff
@@ -129,6 +129,7 @@ func (s *Server) LoadPartition(ctx context.Context, pid entity.PartitionID, spac
 	for _, replica := range replicas {
 		if server, err := s.client.Master().QueryServer(context.Background(), replica); err != nil {
 			log.Error("partition recovery get server info err: %s", err.Error())
+			s.raftResolver.AddNode(replica, &entity.Replica{NodeID: replica})
 		} else {
 			s.raftResolver.AddNode(replica, server.Replica())
 		}
@@ -178,11 +179,19 @@ func (s *Server) CreatePartition(ctx context.Context, space *entity.Space, pid e
 		for _, nodeId := range store.Partition.Replicas {
 			if server, err := s.client.Master().QueryServer(ctx, nodeId); err != nil {
 				fs := s.client.Master().QueryFailServerByNodeID(ctx, nodeId)
+				var replica *entity.Replica
 				if fs == nil {
 					log.Error("get server info err %s", err.Error())
 					return err
 				}
 				log.Warn("get nodeid: %d, failserver %+v", nodeId, fs)
+				if fs.Node != nil {
+					replica = fs.Node.Replica()
+				} else {
+					replica = &entity.Replica{}
+				}
+				replica.NodeID = fs.ID
+				s.raftResolver.AddNode(nodeId, replica)
 			} else {
 				s.raftResolver.AddNode(nodeId, server.Replica())
 			}
```

**File**: `internal/ps/server.go` (modified, +1/-0)
```diff
@@ -279,6 +279,7 @@ func (s *Server) HandleRaftReplicaEvent(event *raftstore.RaftReplicaEvent) {
 		if node := s.raftResolver.GetNode(event.Replica.NodeID); node == nil { // if not found, get it from master
 			if server, err := s.client.Master().QueryServer(context.Background(), event.Replica.NodeID); err != nil {
 				log.Error("get server info error: %s", err.Error())
+				s.raftResolver.AddNode(event.Replica.NodeID, &entity.Replica{NodeID: event.Replica.NodeID})
 			} else {
 				s.raftResolver.AddNode(event.Replica.NodeID, server.Replica())
 			}
```

**File**: `internal/ps/storage/raftstore/store.go` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ func (s *Store) Start() (err error) {
 		peer := proto.Peer{Type: proto.PeerNormal, ID: uint64(repl)}
 		raftConf.Peers = append(raftConf.Peers, peer)
 	}
-	raftLog, err := rlog.NewLog(config.Conf().GetLogDir(), "PS.RAFT", vearchlog.WarnLogType)
+	raftLog, err := rlog.NewLog(config.Conf().GetLogDir(), "PS.RAFT", vearchlog.DebugLogType)
 	if err != nil {
 		s.Engine.Close()
 		return vearchpb.NewError(vearchpb.ErrorEnum_INTERNAL_ERROR, fmt.Errorf("start partition[%d] open raft log error: %s", s.Partition.Id, err.Error()))
```

#### Recent Merged Pull Requests:
- **PR #886** (2026-07-27): feat(index): support by-name dynamic add/remove of scalar and vector … (@zcdb)
- **PR #885** (2026-07-21): perf: batch field reads via MultiGet and batch is_killed() checks in … (@zcdb)
- **PR #884** (2026-07-20): fix: replace busy-wait with blocking select in router search (@Anpeihang)
- **PR #883** (2026-07-19): fix: replace buggy quickSort with sort.Slice in search result merge (@Anpeihang)
- **PR #882** (2026-07-18): perf(vector index): reduce is_killed() checks on search hot path... (@zcdb)
- **PR #881** (2026-07-17): perf: skip alias reload+retry on cache miss (@zcdb)
- **PR #880** (2026-07-08): feat: SCAN fallback for composite scalar index (@zcdb)
- **PR #879** (2026-07-07): feat(flat): support RocksDB disk store and optimize FLAT search (@zcdb)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
