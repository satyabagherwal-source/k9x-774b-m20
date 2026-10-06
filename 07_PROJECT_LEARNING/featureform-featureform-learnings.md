# Forensic Learning Record (Deep Inspection): featureform/featureform

> **Canonical Artifact**: `07_PROJECT_LEARNING/featureform-featureform-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/featureform/featureform](https://github.com/featureform/featureform))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:46:42.263Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `featureform/featureform`
- **Description**: The Virtual Feature Store. Turn your existing data infrastructure into a feature store.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 1990 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/src/featureform/file_utils.py`
```
#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
#  Copyright 2024 FeatureForm Inc.
#

import os


def absolute_file_paths(directory):
    for dirpath, _, filenames in os.walk(directory):
        for f in filenames:
            yield os.path.abspath(os.path.join(dirpath, f)), f

```

### Core Architecture Module: `dashboard/src/components/searchresults/searchengine/SearchEngine.js`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

export default class SearchEngine {
  scores = {
    name: 15,
    description: 5,
    tags: 5,
  };

  createFormattedStrings(matchPositions, item) {
    for (const k of Object.keys(matchPositions)) {
      if (matchPositions[k].size === 0) {
        continue;
      }
      let originalText;
      if (k === 'name') {
        originalText = item.name;
      } else if (k === 'description') {
        originalText = item.variants[item['default-variant']].description;
      }

      let formattedString = '';
      let lastPos = 0;
      let posArray = Array.from(matchPositions[k]);
      posArray.sort((first, second) => {
        if (first < second) {
          return -1;
        }
        if (first > second) {
          return 1;
        }
        return 0;
      });
      for (let i = 0; i < posArray.length; i++) {
        const pos1 = posArray[i];
        i++;
        const pos2 = posArray[i];
        formattedString += originalText.substring(lastPos, pos1);
        formattedString += '<b>';
        formattedString += originalText.substring(pos1, pos2);
        formattedString += '</b>';
        lastPos = pos2;
      }
      formattedString += originalText.substring(lastPos, originalText.length);

      if (k === 'name') {
        item['formattedName'] = formattedString;
      } else if (k === 'description') {
        item['formattedDescription'] = formattedString;
      }
    }
  }

  sortValueList(list) {
    list.sort(function (first, second) {
      if (first[1] > second[1]) {
        return -1;
      }
      if (first[1] < second[1]) {
        return 1;
      }
      return 0;
    });
    let returnArray = [];
    list.forEach((item) => (item[1] ? returnArray.push(item[0]) : []));
    return returnArray;
  }

  sliceQuery(query) {
    let queryArray = query.trim().split(/[ ,]+/);
    let slices = [];
    for (let i = 0; i < queryArray.length; i++) {
      for (let j = i + 1; j < queryArray.length + 1; j++) {
        slices.push(queryArray.slice(i, j));
      }
    }
    return slices;
  }
  sortedResultsByRelevance(data, query) {
    let itemScores = [];
    let maxScore = 0;
    data.forEach((item) => {
      let score = 0;
      const itemData = {
        name: item.name.toLowerCase(),
        description: item.variants[item['default-variant']].description
          ? item.variants[item['default-variant']].description.toLowerCase()
          : '',
        tags: item.variants[item['default-variant']].tags
          ? item.variants[item['default-variant']].tags.join(' ').toLowerCase()
          : '',
      };

      const querySlices = this.sliceQuery(query);
      let matchPositions = {};
      Object.keys(this.scores).forEach((key) => {
        if (key !== 'tags') {
          matchPositions[key] = new Set();
        }
      });
      querySlices.forEach((slice) => {
        const sliceLength = slice.length;
        const sliceString = slice.join(' ');

        for (const [k, v] of Object.entries(this.scores)) {
          const queryIndexInItem = itemData[k].indexOf(sliceString);
          if (queryIndexInItem > -1) {
            if (k !== 'tags') {
              matchPositions[k].add(queryIndexInItem);
              matchPositions[k].add(queryIndexInItem + sliceString.length);
            }
            score += v * sliceLength * (Math.log(sliceString.length) + 1);
          }
        }
      });
      this.createFormattedStrings(matchPositions, item);
      maxScore = Math.max(maxScore, score);

      itemScores.push([item, score]);
    });

    let sortedItemList = this.sortValueList(itemScores);
    return [sortedItemList, maxScore];
  }

  filterSearch(query, unfilteredData) {
    const lowerCaseQuery = query.toLowerCase();
    let filteredData = {};
    filteredData['data'] = {};
    let keyOrder = [];
    Object.keys(unfilteredData).forEach((key) => {
      const sortedResults = this.sortedResultsByRelevance(
        unfilteredData[key],
        lowerCaseQuery
      );

      keyOrder.push([key, sortedResults[1]]);
      if (sortedResults[0].length > 0) {
        filteredData['data'][key] = sortedResults[0];
      }
    });
    let typeOrder = this.sortValueList(keyOrder);

    filteredData['typeOrder'] = typeOrder;
    return filteredData;
  }
}

```

### Core Architecture Module: `dashboard/src/components/searchresults/searchengine/index.js`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

export { default } from './SearchEngine.js';

```

### Core Architecture Module: `dashboard/src/hooks/dataAPI.js`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

let hostname = 'localhost';
let port = 3000;
if (typeof window !== 'undefined') {
  hostname = window.location.hostname;
  port = window.location.port;
}
var API_URL = '//' + hostname + ':' + port;
if (process.env.REACT_APP_API_URL) {
  API_URL = process.env.REACT_APP_API_URL.trim();
}

//if you want to override the api url (in any environment local to your machine, set this in ".env.local")
//.env.local is not tracked in source
if (process.env.NEXT_PUBLIC_REACT_APP_API_URL) {
  API_URL = process.env.NEXT_PUBLIC_REACT_APP_API_URL.trim();
}

export function useDataAPI() {
  const getTags = async (type = '', resourceName = '', variant = '') => {
    const address = `${API_URL}/data/${type}/${resourceName}/gettags`;
    const result = await fetch(address, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ variant: variant }),
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error(error);
        return error;
      });
    return result;
  };

  const postTags = async (
    type = '',
    resourceName = '',
    variant = '',
    tagList = []
  ) => {
    const address = `${API_URL}/data/${type}/${resourceName}/tags`;
    const result = await fetch(address, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: tagList, variant: variant }),
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error(error);
        return error;
      });
    return result;
  };

  const getTaskRuns = async (searchParams = {}) => {
    const result = await fetch(`${API_URL}/data/taskruns`, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchParams),
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching tasks from server: ', error);

        return [];
      });

    return result;
  };

  const getTaskRunDetails = async (taskId = '', taskRunId = '') => {
    const result = await fetch(
      `${API_URL}/data/taskruns/taskrundetail/${taskId}/${taskRunId}`,
      {
        cache: 'no-store',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching tasks from server: ', error);

        return [];
      });

    return result;
  };

  const getTypeTags = async (resourceType = '') => {
    const result = await fetch(`${API_URL}/data/${resourceType}/prop/tags`, {
      cache: 'no-store',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching tags list from server: ', error);

        return [];
      });

    return result;
  };

  const getTypeOwners = async (resourceType = '') => {
    const result = await fetch(`${API_URL}/data/${resourceType}/prop/owners`, {
      cache: 'no-store',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching owners list from server: ', error);

        return [];
      });

    return result;
  };

  const getProviders = async (filters = {}) => {
    const result = await fetch(`${API_URL}/data/providers`, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching providers from server: ', error);

        return [];
      });

    return result;
  };

  const getFeatureVariants = async (filters = {}) => {
    const result = await fetch(`${API_URL}/data/feature/variants`, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching feature variants from server: ', error);

        return [];
      });

    return result;
  };

  const getSourceVariants = async (filters = {}) => {
    const result = await fetch(`${API_URL}/data/datasets/variants`, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching dataset variants from server: ', error);

        return [];
      });

    return result;
  };

  const getLabelVariants = async (filters = {}) => {
    const result = await fetch(`${API_URL}/data/label/variants`, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching dataset variants from server: ', error);

        return [];
      });

    return result;
  };

  const getTrainingSetVariants = async (filters = {}) => {
    const result = await fetch(
      `${API_URL}/data/training-sets/variants`,
      {
        cache: 'no-store',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(filters),
      }
    )
      .then((res) => res.json())
      .catch((error) => {
        console.error(
          'Error fetching trainingsets variants from server: ',
          error
        );

        return [];
      });

    return result;
  };
  const getEntities = async (filters = {}) => {
    const result = await fetch(`${API_URL}/data/entities`, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching entities from server: ', error);

        return [];
      });

    return result;
  };

  const getModels = async (filters = {}) => {
    const result = await fetch(
      `${API_URL}/data/models`, 
      {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching models from server: ', error);

        return [];
      });

    return result;
  };

  const searchResources = async (query) => {
    const result = await fetch(
      `${API_URL}/data/search?q=${query}`, 
      {
      cache: 'no-store',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((res) => res.json())
      .catch((error) => {
        console.error('Error fetching search results from server: ', error);

        return [];
      });

    return result;
  };
        
  return {
    getTags,
    postTags,
    getTaskRuns,
    getTaskRunDetails,
    getTypeTags,
    getProviders,
    getFeatureVariants,
    getSourceVariants,
    getTypeOwners,
    getLabelVariants,
    getTrainingSetVariants,
    getEntities,
    searchResources,
    getModels,
  };
}

```

### Core Architecture Module: `dashboard/src/serviceWorker.js`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

// This optional code is used to register a service worker.
// register() is not called by default.

// This lets the app load faster on subsequent visits in production, and gives
// it offline capabilities. However, it also means that developers (and users)
// will only see deployed updates on subsequent visits to a page, after all the
// existing tabs open on the page have been closed, since previously cached
// resources are updated in the background.

// To learn more about the benefits of this model and instructions on how to
// opt-in, read https://bit.ly/CRA-PWA

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 are considered localhost for IPv4.
    window.location.hostname.match(
      /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
    )
);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Our service worker won't work if PUBLIC_URL is on a different origin
      // from what our page is served on. This might happen if a CDN is used to
      // serve assets; see https://github.com/facebook/create-react-app/issues/2374
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      if (isLocalhost) {
        // This is running on localhost. Let's check if a service worker still exists or not.
        checkValidServiceWorker(swUrl, config);

        // Add some additional logging to localhost, pointing developers to the
        // service worker/PWA documentation.
        navigator.serviceWorker.ready.then(() => {
          console.log(
            'This web app is being served cache-first by a service ' +
              'worker. To learn more, visit https://bit.ly/CRA-PWA'
          );
        });
      } else {
        // Is not localhost. Just register service worker
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated precached content has been fetched,
              // but the previous service worker will still serve the older
              // content until all client tabs are closed.
              console.log(
                'New content is available and will be used when all ' +
                  'tabs for this page are closed. See https://bit.ly/CRA-PWA.'
              );

              // Execute callback
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // At this point, everything has been precached.
              // It's the perfect time to display a
              // "Content is cached for offline use." message.
              console.log('Content is cached for offline use.');

              // Execute callback
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log(
        'No internet connection found. App is running in offline mode.'
      );
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

```

### Core Architecture Module: `lib/proto_utils.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

package lib

import (
	"github.com/featureform/fferr"
	"github.com/repeale/fp-go"
	"google.golang.org/protobuf/proto"
)

// EqualProtoContents compares two slices of proto messages to check that the contents are the same.
// It excludes the order and dedupes.
func EqualProtoContents[T proto.Message](a, b []T) (bool, error) {
	// We marshal the proto messages to strings so that we can compare them in a set
	var errors error
	marshaledA := fp.Map[T, string](func(x T) string {
		marshal, err := proto.Marshal(x)
		if err != nil {
			errors = err
		}
		return string(marshal)
	})(a)

	marshaledB := fp.Map[T, string](func(x T) string {
		marshal, err := proto.Marshal(x)
		if err != nil {
			errors = err
		}
		return string(marshal)
	})(b)

	if errors != nil {
		return false, fferr.NewInternalErrorf("errors marshaling proto messages: %v", errors)
	}

	setA := ToSet[string](marshaledA)
	setB := ToSet[string](marshaledB)
	return setA.Equal(setB), nil
}

func EqualProtoSlices[T proto.Message](a, b []T) bool {
	if len(a) != len(b) {
		return false
	}

	for i, x := range a {
		if !proto.Equal(x, b[i]) {
			return false
		}
	}
	return true
}

```

### Core Architecture Module: `lib/slice_utils.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

package lib

import mapset "github.com/deckarep/golang-set/v2"

type Orderable interface {
	LessThan(Orderable) bool
}

func QuickSortInPlace[A Orderable](as []A) {
	quickSort(as, 0, len(as)-1)
}

func quickSort[A Orderable](as []A, low int, high int) {
	if low < high {
		p := partition(as, low, high)
		quickSort(as, low, p-1)
		quickSort(as, p+1, high)
	}
}

func partition[A Orderable](as []A, low int, high int) int {
	pivot := as[high]
	i := low - 1
	for j := low; j <= high-1; j++ {
		if as[j].LessThan(pivot) {
			i++
			as[i], as[j] = as[j], as[i]
		}
	}
	as[i+1], as[high] = as[high], as[i+1]
	return i + 1
}

func Dedupe[A comparable](as []A) []A {
	s := mapset.NewSet[A]()
	for _, v := range as {
		s.Add(v)
	}
	return s.ToSlice()
}

// ToSet takes a slice of type A and returns a mapset.Set of type A.
// Example usage:
//
//	s := ToSet[int]([]int{1, 2, 3, 4, 5})
//	s.Add(6)
//	fmt.Println(s.Contains(3)) // true
func ToSet[A comparable](as []A) mapset.Set[A] {
	set := mapset.NewSet[A]()
	for _, item := range as {
		set.Add(item)
	}
	return set
}

```

### Core Architecture Module: `runner/worker/main/main.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

package main

import (
	"log"

	"github.com/featureform/runner/worker"
)

func main() {
	if err := worker.CreateAndRun(); err != nil {
		log.Fatalln(err)
	}
}

```

### Core Architecture Module: `runner/worker/worker.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

package worker

import (
	"errors"
	"fmt"
	"os"
	"strconv"

	"github.com/featureform/runner"
	"go.uber.org/zap"
)

type Config []byte

func CreateAndRun() error {
	logger := zap.NewExample().Sugar()
	config, ok := os.LookupEnv("CONFIG")

	if !ok {
		return errors.New("CONFIG not set")
	}
	fmt.Printf("Config: %v\n", config)
	name, ok := os.LookupEnv("NAME")

	if !ok {
		return errors.New("NAME not set")
	}
	jobRunner, err := runner.Create(runner.RunnerName(name), []byte(config))
	if err != nil {
		return err
	}
	indexString, hasIndexEnv := os.LookupEnv("JOB_COMPLETION_INDEX")
	indexRunner, isIndexRunner := jobRunner.(runner.IndexRunner)
	if isIndexRunner && !hasIndexEnv {
		return errors.New("index runner needs index set")
	}
	if !isIndexRunner && hasIndexEnv {
		return errors.New("runner is not an index runner")
	}
	if hasIndexEnv && isIndexRunner {
		index, err := strconv.Atoi(indexString)
		if err != nil {
			return errors.New("index not of type int")
		}
		if err := indexRunner.SetIndex(index); err != nil {
			return errors.New("cannot set index")
		}
		jobRunner = indexRunner
	}
	watcher, err := jobRunner.Run()
	if err != nil {
		return err
	}
	if err := watcher.Wait(); err != nil {
		return err
	}
	logger.Infof("Completed job for resource %v", jobRunner.Resource())
	if jobRunner.IsUpdateJob() {
		jobResource := jobRunner.Resource()
		logger.Infof("Logging update success in etcd for job: %v", jobResource)
	}
	return nil
}

```

### Core Architecture Module: `api/api.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

package api

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"strconv"
	"strings"
	"time"

	grpc_middleware "github.com/grpc-ecosystem/go-grpc-middleware"
	grpc_logrus "github.com/grpc-ecosystem/go-grpc-middleware/logging/logrus"
	"github.com/sirupsen/logrus"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	grpc_health "google.golang.org/grpc/health"
	"google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/reflection"
	grpc_status "google.golang.org/grpc/status"

	"github.com/featureform/fferr"
	"github.com/featureform/health"
	"github.com/featureform/helpers"
	"github.com/featureform/logging"
	"github.com/featureform/metadata"
	pb "github.com/featureform/metadata/proto"
	srv "github.com/featureform/proto"
	"github.com/featureform/provider"
	pt "github.com/featureform/provider/provider_type"
)

type ApiServer struct {
	Logger     logging.Logger
	address    string
	grpcServer *grpc.Server
	listener   net.Listener
	metadata   MetadataServer
	online     OnlineServer
}

type MetadataServer struct {
	address string
	Logger  logging.Logger
	meta    pb.MetadataClient
	client  *metadata.Client
	pb.UnimplementedApiServer
	health *health.Health
}

type OnlineServer struct {
	Logger  logging.Logger
	address string
	client  srv.FeatureClient
	srv.UnimplementedFeatureServer
}

func NewApiServer(logger logging.Logger, address string, metaAddr string, srvAddr string) (*ApiServer, error) {
	if srvAddr == "" {
		logger.Info("API server not connecting to serving endpoint")
	}
	return &ApiServer{
		Logger:  logger,
		address: address,
		metadata: MetadataServer{
			address: metaAddr,
			Logger:  logger,
		},
		online: OnlineServer{
			Logger:  logger,
			address: srvAddr,
		},
	}, nil
}

// rpc CreateUser(User) returns (Empty);
// - Anyone can create
func (serv *MetadataServer) CreateUser(ctx context.Context, userRequest *pb.UserRequest) (*pb.Empty, error) {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(ctx)
	logger = logger.WithResource(logging.User, userRequest.User.Name, logging.NoVariant)
	logger.Infow("Creating User")
	userRequest.RequestId = requestID.String()

	serv.Logger.Infow("Creating User", "user", userRequest.User)
	out, err := serv.meta.CreateUser(ctx, userRequest)
	if err != nil {
		return nil, err
	}

	return out, nil
}

func (serv *MetadataServer) PruneResource(ctx context.Context, req *pb.PruneResourceRequest) (*pb.PruneResourceResponse, error) {
	_, ctx, logger := serv.Logger.InitializeRequestID(ctx)
	logger = logger.WithResource(logging.ResourceTypeFromProto(req.ResourceId.ResourceType), req.ResourceId.Resource.Name, req.ResourceId.Resource.Variant)
	logger.Infow("Pruning Resource")

	out, err := serv.meta.PruneResource(ctx, req)
	if err != nil {
		serv.Logger.Errorw("Failed to prune resource", "error", err)
		return nil, err
	}

	logger.Infow("Successfully pruned resource")
	return out, nil
}

func (serv *MetadataServer) MarkForDeletion(ctx context.Context, req *pb.MarkForDeletionRequest) (*pb.MarkForDeletionResponse, error) {
	_, ctx, logger := serv.Logger.InitializeRequestID(ctx)
	logger = logger.WithResource(logging.ResourceTypeFromProto(req.ResourceId.ResourceType), req.ResourceId.Resource.Name, req.ResourceId.Resource.Variant)
	logger.Infow("Marking Resource for Deletion")

	out, err := serv.meta.MarkForDeletion(ctx, req)
	if err != nil {
		serv.Logger.Errorw("Failed to mark resource for deletion", "error", err)
		return nil, err
	}

	logger.Infow("Successfully marked resource for deletion")
	return out, nil
}

// rpc GetUsers(stream Name) returns (stream User);
// - Anyone can get
func (serv *MetadataServer) GetUsers(stream pb.Api_GetUsersServer) error {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
	logger.Infow("Getting Users")
	proxyStream, err := serv.meta.GetUsers(ctx)
	if err != nil {
		logger.Errorw("Failed to get users from server", "error", err)
		return err
	}
	for {
		nameRequest, err := stream.Recv()
		if err == io.EOF {
			logger.Debugw("End of stream reached. Stream request completed")
			proxyStream.CloseSend()
			return nil
		}
		if err != nil {
			logger.Errorw("Failed to read client request", "error", err)
			return err
		}
		loggerWithResource := logger.WithResource(logging.User, nameRequest.Name.Name, logging.NoVariant)
		loggerWithResource.Infow("Getting user from stream")
		nameRequest.RequestId = requestID.String()

		sErr := proxyStream.Send(nameRequest)
		if sErr != nil {
			loggerWithResource.Errorw("Failed to send user to the server", "error", sErr)
			return sErr
		}
		res, err := proxyStream.Recv()
		if err != nil {
			loggerWithResource.Errorw("Failed to receive users from server", "error", err)
			return err
		}
		sendErr := stream.Send(res)
		if sendErr != nil {
			loggerWithResource.Errorw("Failed to send users to client", "error", sendErr)
			return sendErr
		}
	}
}

// rpc GetFeatures(stream Name) returns (stream Feature);
// - Anyone can get
func (serv *MetadataServer) GetFeatures(stream pb.Api_GetFeaturesServer) error {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
	logger.Infow("Getting Features")
	proxyStream, err := serv.meta.GetFeatures(ctx)
	if err != nil {
		logger.Errorw("Failed to get features from server", "error", err)
		return err
	}
	for {
		nameRequest, err := stream.Recv()
		if err == io.EOF {
			logger.Debugw("End of stream reached. Stream request completed")
			proxyStream.CloseSend()
			return nil
		}
		if err != nil {
			logger.Errorw("Failed to read client request", "error", err)
			return err
		}
		loggerWithResource := logger.WithResource(logging.Feature, nameRequest.Name.Name, logging.NoVariant)
		loggerWithResource.Infow("Getting feature from stream")
		nameRequest.RequestId = requestID.String()
		sErr := proxyStream.Send(nameRequest)
		if sErr != nil {
			loggerWithResource.Errorw("Failed to send feature to the server", "error", sErr)
			return sErr
		}
		res, err := proxyStream.Recv()
		if err != nil {
			loggerWithResource.Errorw("Failed to receive features from server", "error", err)
			return err
		}
		sendErr := stream.Send(res)
		if sendErr != nil {
			loggerWithResource.Errorw("Failed to send features to client", "error", sendErr)
			return sendErr
		}
	}
}

// rpc GetFeatureVariants(stream NameVariant) returns (stream FeatureVariant);
// - Anyone can get
func (serv *MetadataServer) GetFeatureVariants(stream pb.Api_GetFeatureVariantsServer) error {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
	logger.Infow("Getting Feature Variants")
	proxyStream, err := serv.meta.GetFeatureVariants(ctx)
	if err != nil {
		logger.Errorw("Failed to get feature variants from server", "error", err)
		return err
	}
	for {
		nameVariantRequest, err := stream.Recv()
		if err == io.EOF {
			logger.Debugw("End of stream reached. Stream request completed")
			proxyStream.CloseSend()
			return nil
		}
		if err != nil {
			logger.Errorw("Failed to read client request", "error", err)
			return err
		}
		loggerWithResource := logger.WithResource(logging.Feature, nameVariantRequest.NameVariant.Name, nameVariantRequest.NameVariant.Variant)
		loggerWithResource.Infow("Getting feature variant from stream")
		nameVariantRequest.RequestId = requestID.String()

		sErr := proxyStream.Send(nameVariantRequest)
		if sErr != nil {
			loggerWithResource.Errorw("Failed to send feature variant to the server", "error", sErr)
			return sErr
		}
		res, err := proxyStream.Recv()
		if err != nil {
			loggerWithResource.Errorw("Failed to receive feature variants from server", "error", err)
			return err
		}
		sendErr := stream.Send(res)
		if sendErr != nil {
			loggerWithResource.Errorw("Failed to send feature variants to client", "error", sendErr)
			return sendErr
		}
	}
}

func (serv *MetadataServer) GetLabels(stream pb.Api_GetLabelsServer) error {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
	logger.Infow("Getting Labels")
	proxyStream, err := serv.meta.GetLabels(ctx)
	if err != nil {
		logger.Errorw("Failed to get labels from server", "error", err)
		return err
	}
	for {
		nameRequest, err := stream.Recv()
		if err == io.EOF {
			logger.Debugw("End of stream reached. Stream request completed")
			proxyStream.CloseSend()
			return nil
		}
		if err != nil {
			logger.Errorw("Failed to read client request", "error", err)
			return err
		}
		loggerWithResource := logger.WithResource(logging.Label, nameRequest.Name.Name, logging.NoVariant)
		loggerWithResource.Infow("Getting label from stream")
		nameRequest.RequestId = requestID.String()
		sErr := proxyStream.Send(nameRequest)
		if sErr != nil {
			loggerWithResource.Errorw("Failed to send labels to the server", "error", sErr)
			return sErr
		}
		res, err := proxyStream.Recv()
		if err != nil {
			loggerWithResource.Errorw("Failed to receive labels from server", "error", err)
			return err
		}
		sendErr := stream.Send(res)
		if sendErr != nil {
			loggerWithResource.Errorw("Failed to send labels to client", "error", sendErr)
			return sendErr
		}
	}
}

// rpc GetLabelVariants(stream NameVariant) returns (stream LabelVariant);
// - Anyone can get
func (serv *MetadataServer) GetLabelVariants(stream pb.Api_GetLabelVariantsServer) error {
	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
	logger.Infow("Getting Label Variants")
	proxyStream, err := serv.meta.GetLabelVariants(ctx)
	if err != nil {
		logger.Errorw("Failed to get label variants from server", "error", err)
		return err
	}
	for {
		nameVariantRequest, err := stream.Recv()
		if err == io.EOF {
			logger.Debugw("End of stream reached. Stream request completed")
			pr
```

### Core Architecture Module: `api/main/main.go`
```
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright 2024 FeatureForm Inc.
//

package main

import (
	"fmt"

	"github.com/joho/godotenv"

	"github.com/featureform/api"
	"github.com/featureform/health"
	help "github.com/featureform/helpers"
	"github.com/featureform/logging"
)

func main() {
	err := godotenv.Load(".env")
	if err != nil {
		fmt.Printf("could not fetch .env file: %s", err.Error())
	}

	logger := logging.NewLogger("api")
	apiPort := help.GetEnv("API_PORT", "7878")
	logger.Infow("Retrieved API port from ENV", "port", apiPort)
	apiStatusPort := help.GetEnv("API_STATUS_PORT", "8443")
	logger.Infow("Retrieved API status port from ENV", "port", apiStatusPort)
	metadataHost := help.GetEnv("METADATA_HOST", "localhost")
	logger.Infow("Retrieved metadata host from ENV", "host", metadataHost)
	metadataPort := help.GetEnv("METADATA_PORT", "8080")
	logger.Infow("Retrieved metadata port from ENV", "port", metadataPort)
	servingHost := help.GetEnv("SERVING_HOST", "localhost")
	logger.Infow("Retrieved serving host from ENV", "host", servingHost)
	servingPort := help.GetEnv("SERVING_PORT", "8080")
	logger.Infow("Retrieved serving port from ENV", "port", servingPort)
	skipFeatureServing := help.GetEnvBool("SKIP_FEATURE_SERVING", false)
	logger.Infow("Should skip feature serving?", "bool", skipFeatureServing)
	apiConn := fmt.Sprintf("0.0.0.0:%s", apiPort)
	metadataConn := fmt.Sprintf("%s:%s", metadataHost, metadataPort)
	servingConn := fmt.Sprintf("%s:%s", servingHost, servingPort)
	if skipFeatureServing {
		servingConn = ""
	}

	if err := health.StartHttpServer(logger, apiStatusPort); err != nil {
		logger.Errorw("Error starting health check HTTP server", "error", err)
		panic(fmt.Sprintf("health check HTTP server failed: %+v", err))
	}

	serv, err := api.NewApiServer(logger, apiConn, metadataConn, servingConn)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Println(serv.Serve())
}

```

### Core Architecture Module: `benchmark/data_generator.py`
```
#  This Source Code Form is subject to the terms of the Mozilla Public
#  License, v. 2.0. If a copy of the MPL was not distributed with this
#  file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
#  Copyright 2024 FeatureForm Inc.
#

import datetime
import pyarrow as pa
import pyarrow.parquet as pq
import pandas as pd
import numpy as np
from pathlib import Path

import csv


def generate_data(num_rows: int, num_features: int, key_space: int) -> pd.DataFrame:
    features = [f"feature_{i}" for i in range(num_features)]
    columns = ["entity", "event_timestamp"] + features
    df = pd.DataFrame(0, index=np.arange(num_rows), columns=columns)
    df["event_timestamp"] = datetime.datetime.utcnow()
    for column in ["entity"] + features:
        df[column] = np.random.randint(1, key_space, num_rows)
    df["entity"] = df["entity"].astype(str)
    return df


if __name__ == "__main__":
    df = generate_data(10**4, 250, 10**4)
    df.to_csv("generated_data.csv", index=False)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1576** (2025-09-19): **[Bug]: Invalid JSON error when specifying S3 output location in Spark Provider**
  *Symptoms*: ### Expected Behavior  I am currently setting up a Featureform environment for my team. I have deployed the featureformcom/featureform:0.14.0 container as an all-in-one service and installed the necessary Spark-related packages, as I require Spark as the backend.  ### Actual Behavior  After installing all the services and configuring the backend, I encountered the error `Invalid JSON: outputLocation:s3a://test-bucket/dev/featureform/HealthCheck/health_check_out`  Based on the error message, it seems that when Featureform executes offline_store_spark_runner.py, there is an issue with the provided input. The system expects a JSON-formatted string, but the actual input does not meet this expectation  ### Steps To Reproduce  The custom featureform docker image is: ``` FROM featureformcom/featureform:0.14.0  RUN apt update && apt install -y build-essential libssl-dev zlib1g-dev \ libbz2-dev libreadline-dev libsqlite3-dev curl git \ libncursesw5-dev xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev  RUN curl https://pyenv.run | bash  ENV PYENV_ROOT /root/.pyenv ENV PATH $PYENV_ROOT/bin:$PATH  RUN bash -c 'eval "$(pyenv init --path)" && \     eval "$(pyenv init -)" && \     pyenv install 3.8.16 && \     pyenv global 3.8.16'  RUN apt-get update && apt-get install -y default-jdk  ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ENV PATH=$PATH:$JAVA_HOME/bin  RUN bash -c 'eval "$(pyenv init --path)" && \     eval "$(pyenv init -)" && \     pip install pyspark==3.4.0'  `
  **Post-Mortem & Fix Analysis**:
  > @ff-kamal  could you take a look at this
  > Taking a look.
  > @ff-kamal Thanks for your help. Do you need any additional information?

- **Issue #1558** (2025-09-19): **[Bug]: Confusing helm chart configuration**
  *Symptoms*: ### Expected Behavior  Hi, I recently tried to install featureform using a helm chart, but I encountered quite a few problems during the installation. Here are the commands I used for the installation:  ```bash helm upgrade --install featureform featureform/featureform \ --namespace featureform \ --create-namespace \ --set repository=featureformcom \ --set nginx.enabled=false \ --set cert.publicCert=false \ --set cert.selfSignedCert=false \ --set cert.letsencryptProd=false \ --set logging.enabled=false \ --set psql.createSecret=true \ ```    ### Actual Behavior  The first problem I encountered is that the chart's repository is featureformenterprise, but most of the images are in the featureformcom repo. When I set `--set repository=featureformcom`, most of the pods can be successfully created, except for search-loader; this pod is still in the featureformenterprise repo. The second issue is that PostgreSQL seems to be necessary for the featureform service, but this isn't specifically mentioned in the documentation.  ### Steps To Reproduce  ```bash helm upgrade --install featureform featureform/featureform \ --namespace featureform \ --create-namespace \ --set repository=featureformcom \ --set nginx.enabled=false \ --set cert.publicCert=false \ --set cert.selfSignedCert=false \ --set cert.letsencryptProd=false \ --set logging.enabled=false \ --set psql.createSecret=true \ ```  ### What mode are you running Featureform in?  Hosted  ### What version of Python are you running?  3
  **Post-Mortem & Fix Analysis**:
  > Good catch, we're actually in the midst of moving this over and the code changed before the docs. Let me get you an update soon. If you'd like specific help in the short term, feel free to join or slack community for specific help for your deployment.
  > @simba-git  Thanks for for your reply.

- **Issue #1543** (2025-01-07): **[Bug]: grpc: error unmarshalling request: string field contains invalid UTF-8**
  *Symptoms*: ### Expected Behavior  Successful application of definitions  ### Actual Behavior  grpc._channel._InactiveRpcError: <_InactiveRpcError of RPC that terminated with:         status = StatusCode.INTERNAL         details = "grpc: error unmarshalling request: string field contains invalid UTF-8"         debug_error_string = "UNKNOWN:Error received from peer  {created_time:"2025-01-07T03:22:45.988764497-05:00", grpc_status:13, grpc_message:"grpc: error unmarshalling request: string field contains invalid UTF-8"}"  ### Steps To Reproduce  featureform apply quickstart/definitions.py --insecure  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.12  ### Featureform Python Package Version  1.14.0  ### Featureform Helm Chart Version  _No response_  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_
  **Post-Mortem & Fix Analysis**:
  > The issue is resolved, and we have just pushed out a new image, let us know if you run into any further issues.  For the team: The issue was due to the a manual pushing of the `featureformcom/featureform` Docker image without properly tagging it as latest, so an older version of the image was being pulled automatically. This older image had an incompatible protobuf spec as compared to the latest client, which resulted in this error that was thrown above.  Our CI/CD pipeline seems to automatically tags it properly, but it looks like we went with an out-of-band push. We should take proper care in the future to prevent incidents like this.
  > Thank you, @ff-kamal. Appreciate your help.

- **Issue #1495** (2025-01-07): **[Bug]: grpc error when applying definitions.py in local development environment**
  *Symptoms*: ### Expected Behavior  ff should register all providers, sources and transformations  ### Actual Behavior  Getting Error  **grpc._channel._InactiveRpcError: <_InactiveRpcError of RPC that terminated with:         status = StatusCode.INTERNAL         details = "grpc: error unmarshalling request: string field contains invalid UTF-8"         debug_error_string = "UNKNOWN:Error received from peer  {created_time:"2024-09-13T11:40:34.503399+05:30", grpc_status:13, grpc_message:"grpc: error unmarshalling request: string field contains invalid UTF-8"}"**  ### Steps To Reproduce  python -m venv .venv && . .venv/bin/activate ./gen_grpc.sh ./pip_update.sh featureform deploy docker --quickstart featureform apply quickstart/definitions.py --insecure  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.9  ### Featureform Python Package Version  1.12.6  ### Featureform Helm Chart Version  _No response_  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_
  **Post-Mortem & Fix Analysis**:
  > @NikhilKr872 have you resolved this? Thanks
  > The issue should be resolved, let us know if you run into any more problems.  See #1543 for more context.

- **Issue #1441** (2024-05-08): **[Bug]: Quickstart files return 403**
  *Symptoms*: ### Expected Behavior  Quickstart should enable a quick start of the app.  https://docs.featureform.com/deployment/quickstart-docker  ### Actual Behavior  Quickstart fails to start.  ### Steps To Reproduce  Upon trying to run FeatureForm on Docker using ``` featureform deploy docker --quickstart ```  The quickstart files https://featureform-demo-files.s3.amazonaws.com/definitions.py https://featureform-demo-files.s3.amazonaws.com/serving.py https://featureform-demo-files.s3.amazonaws.com/training.py  Return 403s.  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.10  ### Featureform Python Package Version  1.12.6  ### Featureform Helm Chart Version  _No response_  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_
  **Post-Mortem & Fix Analysis**:
  > Resolved.

- **Issue #1399** (2024-03-22): **[Bug]: Auth Login is broken**
  *Symptoms*: ### Expected Behavior  The user is able to login using the dashboard.  ### Actual Behavior  When you try to log in via the dashboard, the okta server responds with a failure message suggesting an error with the server configuration.  ### Steps To Reproduce  1. Run a enterprise cluster in k8s. 2. Try to login via the dashboard  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.7  ### Featureform Python Package Version  0.12+  ### Featureform Helm Chart Version  _No response_  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_

- **Issue #1382** (2024-04-20): **[Bug]: client.dataframe() is extremely slow and doesn't seem to be taking into consideration the limit**
  *Symptoms*: ### Expected Behavior  Should be relatively quick  ### Actual Behavior  Takes too long  ### Steps To Reproduce  client.dataframe(scaled_credit_cards, limit=100) ensure limit is passed through  ### What mode are you running Featureform in?  Local  ### What version of Python are you running?  3.10  ### Featureform Python Package Version  1.12.3-rc1  ### Featureform Helm Chart Version  0.12.3-rc  ### Kubernetes Version  _No response_  ### Relevant log output  _No response_

- **Issue #1365** (2024-03-19): **[Bug]: Can't materialize more than 100k rows/entities from BigQuery to Redis**
  *Symptoms*: ### Expected Behavior  I have over 500k rows/entitites in BQ table, when I succesfully sync them to redis, I expect 500k ids in redis:  ``` 127.0.0.1:6379> HKEYS "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"customer_age\",\"Variant\":\"2024-02-29t09-38-30\"}"  ...  499997) "REDACTED_UID"  499998) "REDACTED_UID"  499999) "REDACTED_UID" 500000) "REDACTED_UID" (2.02s)  ```  ### Actual Behavior  I have over 500k rows/entitites in BQ table, when I succesfully sync them to redis, only 100k of the end up there:  ``` 127.0.0.1:6379> HKEYS "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"customer_age\",\"Variant\":\"2024-02-29t09-38-30\"}"  ...  99997) "REDACTED_UID"  99998) "REDACTED_UID"  99999) "REDACTED_UID" 100000) "REDACTED_UID" (2.02s)  ```  If it is under 100k entitites, everything is fine.  Also the keys look weird in the db.   ``` 127.0.0.1:6379> KEYS * 1) "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"customer_age\",\"Variant\":\"2024-02-29t09-38-30\"}" 2) "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"game_ggr_percent\",\"Variant\":\"2024-02-29t09-28-01\"}" 3) "{\"Prefix\":\"Featureform_table__\",\"Feature\":\"game_ggr_percent\",\"Variant\":\"2024-02-29t09-36-27\"}" 4) "Featureform_table____tables" ```  There's some extra proof in https://featureform-community.slack.com/archives/C02MT18CCAZ/p1709298779194169  ### Steps To Reproduce  - Deploy to GKE with the terraform provided in repo - Register BQ provider  - Re
  **Post-Mortem & Fix Analysis**:
  > Did some further testing and the problem seems to be the coordinator job chunk size which is 100k in jobs larger than 100k. Ie. if you are materializing 1M entities, you get 10 chunks. It seems likely that only one chunk gets actually written to redis.
  > Also, enabling k8s_runner in helm values doesnt resolve this
  > Bug is somewhere around here? https://github.com/featureform/featureform/blob/5accad891059280456dfe44afd129ce42054ee47/provider/bigquery.go#L330  If I look at BigQuery job logs, I see the same query multiple times for the same materialization job `SELECT entity, value, ts FROM (     SELECT *     FROM PROJECT.DATASET.featureform_materialization_FEATURE__VARIANT_NAME      WHERE row_number > 0 AND row_number <= 100000)`  It should probably iterate over DIFFERENT 100K segments. 10 queries per 1M materialization job.

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

### Incident Patch 1: `6805b1cd` (2025-04-24)
**Commit Message**: Bug: Add entity to feature equivalence (#1635)

**File**: `metadata/equivalence/feature_variant.go` (modified, +5/-1)
```diff
@@ -10,16 +10,18 @@ package equivalence
 import (
 	"reflect"
 
+	"github.com/google/go-cmp/cmp"
+
 	"github.com/featureform/fferr"
 	pb "github.com/featureform/metadata/proto"
 	"github.com/featureform/provider/types"
-	"github.com/google/go-cmp/cmp"
 )
 
 type featureVariant struct {
 	Name                    string
 	Provider                string
 	ValueType               types.ValueType
+	Entity                  string
 	ComputationMode         string // TODO move definition from metadata to common
 	Location                featureLocation
 	ResourceSnowflakeConfig resourceSnowflakeConfig
@@ -49,6 +51,7 @@ func FeatureVariantFromProto(proto *pb.FeatureVariant) (featureVariant, error) {
 		Name:                    proto.Name,
 		Provider:                proto.Provider,
 		ValueType:               valueType,
+		Entity:                  proto.Entity,
 		ComputationMode:         proto.Mode.String(),
 		Location:                location,
 		ResourceSnowflakeConfig: resourceSnowflakeConfigFromProto(proto.ResourceSnowflakeConfig),
@@ -66,6 +69,7 @@ func (f featureVariant) IsEquivalent(other Equivalencer) bool {
 			return f1.Name == f2.Name &&
 				f1.Provider == f2.Provider &&
 				f1.ValueType == f2.ValueType &&
+				f1.Entity == f2.Entity &&
 				f1.ComputationMode == f2.ComputationMode &&
 				f1.Location.IsEquivalent(f2.Location) &&
 				reflect.DeepEqual(f1.ResourceSnowflakeConfig, f2.ResourceSnowflakeConfig)
```

**File**: `metadata/equivalence/feature_variant_test.go` (modified, +60/-3)
```diff
@@ -8,11 +8,13 @@
 package equivalence
 
 import (
-	pb "github.com/featureform/metadata/proto"
 	"testing"
 
-	"github.com/featureform/provider/types"
+	pb "github.com/featureform/metadata/proto"
+
 	"github.com/stretchr/testify/assert"
+
+	"github.com/featureform/provider/types"
 )
 
 func TestFeatureVariantIsEquivalent(t *testing.T) {
@@ -29,6 +31,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -40,6 +43,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -49,12 +53,41 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 			},
 			expected: true,
 		},
+		{
+			name: "Different Entity",
+			fv1: featureVariant{
+				Name:            "Feature1",
+				Provider:        "Provider1",
+				ValueType:       types.Int8,
+				Entity:          "user_id",
+				ComputationMode: "Mode1",
+				Location: column{
+					Entity: "Entity1",
+					Value:  "Value1",
+					Ts:     "Timestamp1",
+				},
+			},
+			fv2: featureVariant{
+				Name:            "Feature1",
+				Provider:        "Provider1",
+				ValueType:       types.Int8,
+				Entity:          "customer_id",
+				ComputationMode: "Mode1",
+				Location: column{
+					Entity: "Entity1",
+					Value:  "Value1",
+					Ts:     "Timestamp1",
+				},
+			},
+			expected: false,
+		},
 		{
 			name: "Different Names",
 			fv1: featureVariant{
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -66,6 +99,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature2", // Different Name
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -81,6 +115,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -92,6 +127,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider2", // Different Provider
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -107,6 +143,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -118,6 +155,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int16,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -133,6 +171,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode1",
 				Location: column{
 					Entity: "Entity1",
@@ -144,6 +183,7 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 				Name:            "Feature1",
 				Provider:        "Provider1",
 				ValueType:       types.Int8,
+				Entity:          "user_id",
 				ComputationMode: "Mode2",
 				Location: column{
 					Entity: "Entity1",
@@ -157,10 +197,12 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 			name: "Different Locations (Column vs PythonFunction)",
 			fv1: featureVariant{
 				Name:     "Feature1",
+				Entity:   "user_id",
 				Location: column{Entity: "Entity1", Value: "Value1", Ts: "Timestamp1"},
 			},
 			fv2: featureVariant{
 				Name:     "Feature1",
+				Entity:   "user_id",
 				Location: pythonFunction{Query: []byte("SELECT * FROM table")},
 			},
 			expected: false,
@@ -170,11 +212,13 @@ func TestFeatureVariantIsEquivalent(t *testing.T) {
 			fv1: featureVariant{
 				Name:     "Feature1",
 				Provider: "Provider1",
+				Entity:   "user_id",
 				Location: pythonFunction{Query: []byte("SELECT * FROM table")},
 			},
 			fv2: featureVariant{
 				Name:     "Feature1",
 				Provider: "Provider1",
+				Entity:   "user_id",
 				Location: pythonFunction{Query: []byte("SELECT * FROM table")},
 			},
 			expected: true,
@@ -183,10 +227,12 @@ func TestFeatureVariantIsEquivalen
```

---

### Incident Patch 2: `2a8cb469` (2025-04-21)
**Commit Message**: Chore: Remove debug panics (#1629)

**File**: `metadata/client.go` (modified, +3/-3)
```diff
@@ -2773,10 +2773,10 @@ func TrainingSetTypeFromProto(proto pb.TrainingSetType) (TrainingSetType, error)
 	case pb.TrainingSetType_TRAINING_SET_TYPE_VIEW:
 		trainingSetType = ViewTrainingSet
 	case pb.TrainingSetType_TRAINING_SET_TYPE_UNSPECIFIED:
-		logger.DPanic("Training set type unspecified")
+		logger.Error("Training set type unspecified")
 		return trainingSetType, fferr.NewInvalidArgumentErrorf("Training set type unspecified")
 	default:
-		logger.DPanic("Unknown training set type", "proto", proto)
+		logger.Errorw("Unknown training set type", "proto", proto)
 		return trainingSetType, fferr.NewInternalErrorf("Unknown training set type %v", proto)
 	}
 	return trainingSetType, nil
@@ -2792,7 +2792,7 @@ func TrainingSetTypeFromString(trainingSetType string) (TrainingSetType, error)
 	case "VIEW":
 		return ViewTrainingSet, nil
 	default:
-		logger.DPanic("Invalid training set type", "trainingSetType", trainingSetType)
+		logger.Errorw("Invalid training set type", "trainingSetType", trainingSetType)
 		return "", fferr.NewInvalidArgumentErrorf("Invalid training set type %s", trainingSetType)
 	}
 }
```

---

### Incident Patch 3: `070cd454` (2025-04-14)
**Commit Message**: Minor dataset fixes (#1631)

**File**: `provider/clickhouse_test.go` (modified, +0/-6)
```diff
@@ -176,12 +176,6 @@ func (ch *clickHouseOfflineStoreTester) CreateTableFromSchema(loc pl.Location, s
 
 	query := queryBuilder.String()
 	_, err = db.Exec(query)
-	if err != nil {
-		logger.Errorw("error executing query", "query", query, "error", err)
-		return nil, err
-	}
-	// create the table
-	_, err = db.Exec(query)
 	if err != nil {
 		logger.Errorw("error creating table", "error", err)
 		return nil, err
```

**File**: `provider/dataset/sql_dataset.go` (modified, +16/-4)
```diff
@@ -225,21 +225,28 @@ func (it *SqlIterator) Close() error {
 }
 
 func (it *SqlIterator) Next() bool {
-	// Check for context cancellation (optional - depends on whether you need this behavior)
+	// Check for context cancellation
 	select {
 	case <-it.ctx.Done():
 		it.err = it.ctx.Err()
 		it.Close()
 		return false
 	default:
-		// Continue processing
 	}
 
 	if !it.rows.Next() {
 		it.Close()
 		return false
 	}
 
+	if it.scanTargets == nil {
+		it.scanTargets = make([]any, len(it.schema.Fields))
+		for i := range it.scanTargets {
+			var v any
+			it.scanTargets[i] = &v
+		}
+	}
+
 	// Scan row data into scan targets
 	if err := it.rows.Scan(it.scanTargets...); err != nil {
 		it.err = fferr.NewExecutionError("SQL", err)
@@ -252,8 +259,13 @@ func (it *SqlIterator) Next() bool {
 
 	// Convert values according to schema
 	for i, rawPtr := range it.scanTargets {
-		// Extract the value from the pointer
-		val := *(rawPtr.(*any))
+		valPtr, ok := rawPtr.(*any)
+		if !ok {
+			it.err = fferr.NewInternalErrorf("unexpected scan target type at index %d: %T", i, rawPtr)
+			it.Close()
+			return false
+		}
+		val := *valPtr
 
 		nativeType := it.schema.Fields[i].NativeType
 		convertedVal, err := it.converter.ConvertValue(nativeType, val)
```

**File**: `provider/postgres/value_converter.go` (modified, +38/-3)
```diff
@@ -8,6 +8,9 @@
 package postgres
 
 import (
+	"strconv"
+	"strings"
+
 	"github.com/featureform/fferr"
 	types "github.com/featureform/fftypes"
 	"github.com/featureform/logging"
@@ -37,9 +40,12 @@ func (c Converter) GetType(nativeType types.NativeType) (types.ValueType, error)
 
 // ConvertValue converts a value from its PostgreSQL representation to a types.Value
 func (c Converter) ConvertValue(nativeType types.NativeType, value any) (types.Value, error) {
+	// Normalize type name to lowercase
+	normalizedType := strings.ToLower(string(nativeType))
+
 	// Convert the value based on the native type
-	switch nativeType {
-	case "integer":
+	switch normalizedType {
+	case "integer", "int":
 		if value == nil {
 			return types.Value{
 				NativeType: nativeType,
@@ -93,6 +99,35 @@ func (c Converter) ConvertValue(nativeType types.NativeType, value any) (types.V
 			Value:      convertedValue,
 		}, nil
 
+	case "numeric":
+		if value == nil {
+			return types.Value{
+				NativeType: nativeType,
+				Type:       types.Float64,
+				Value:      nil,
+			}, nil
+		}
+		if byteArray, ok := value.([]uint8); ok {
+			floatVal, err := strconv.ParseFloat(string(byteArray), 64)
+			if err != nil {
+				return types.Value{}, err
+			}
+			return types.Value{
+				NativeType: nativeType,
+				Type:       types.Float64,
+				Value:      floatVal,
+			}, nil
+		}
+		convertedValue, err := types.ConvertNumberToFloat64(value)
+		if err != nil {
+			return types.Value{}, err
+		}
+		return types.Value{
+			NativeType: nativeType,
+			Type:       types.Float64,
+			Value:      convertedValue,
+		}, nil
+
 	case "varchar":
 		if value == nil {
 			return types.Value{
@@ -129,7 +164,7 @@ func (c Converter) ConvertValue(nativeType types.NativeType, value any) (types.V
 			Value:      convertedValue,
 		}, nil
 
-	case "timestamp with time zone":
+	case "timestamp with time zone", "timestamptz", "TIMESTAMPTZ":
 		if value == nil {
 			return types.Value{
 				NativeType: nativeType,
```

**File**: `provider/postgres/value_converter_test.go` (modified, +16/-0)
```diff
@@ -32,12 +32,14 @@ func TestConverterGetType(t *testing.T) {
 	}{
 		// Integer types
 		{"integer", "integer", types.Int32, false},
+		{"int", "int", types.Int32, false},
 
 		// Bigint type
 		{"bigint", "bigint", types.Int64, false},
 
 		// Float types
 		{"float8", "float8", types.Float64, false},
+		{"numeric", "numeric", types.Float64, false},
 
 		// String types
 		{"varchar", "varchar", types.String, false},
@@ -47,6 +49,7 @@ func TestConverterGetType(t *testing.T) {
 
 		// Timestamp types
 		{"timestamp with time zone", "timestamp with time zone", types.Timestamp, false},
+		{"timestamptz", "timestamptz", types.Timestamp, false},
 
 		// Unsupported type
 		{"unsupported", "unsupported", nil, true},
@@ -84,6 +87,11 @@ func TestConverterConvertValue(t *testing.T) {
 		{"integer float", "integer", 123.45, types.Value{NativeType: "integer", Type: types.Int32, Value: int32(123)}, false},
 		{"integer string", "integer", "123", types.Value{NativeType: "integer", Type: types.Int32, Value: int32(123)}, false},
 		{"integer invalid", "integer", "abc", types.Value{}, true},
+		{"INT nil", "INT", nil, types.Value{NativeType: "INT", Type: types.Int32, Value: nil}, false},
+		{"INT int", "INT", 123, types.Value{NativeType: "INT", Type: types.Int32, Value: int32(123)}, false},
+		{"INT float", "INT", 123.45, types.Value{NativeType: "INT", Type: types.Int32, Value: int32(123)}, false},
+		{"INT string", "INT", "123", types.Value{NativeType: "INT", Type: types.Int32, Value: int32(123)}, false},
+		{"INT invalid", "INT", "abc", types.Value{}, true},
 
 		// Bigint tests
 		{"bigint nil", "bigint", nil, types.Value{NativeType: "bigint", Type: types.Int64, Value: nil}, false},
@@ -96,6 +104,12 @@ func TestConverterConvertValue(t *testing.T) {
 		{"float8 int", "float8", 123, types.Value{NativeType: "float8", Type: types.Float64, Value: float64(123)}, false},
 		{"float8 string", "float8", "123.45", types.Value{NativeType: "float8", Type: types.Float64, Value: float64(123.45)}, false},
 		{"float8 invalid", "float8", "abc", types.Value{}, true},
+		{"numeric nil", "numeric", nil, types.Value{NativeType: "numeric", Type: types.Float64, Value: nil}, false},
+		{"numeric float", "numeric", 123.45, types.Value{NativeType: "numeric", Type: types.Float64, Value: float64(123.45)}, false},
+		{"numeric int", "numeric", 123, types.Value{NativeType: "numeric", Type: types.Float64, Value: float64(123)}, false},
+		{"numeric string", "numeric", "123.45", types.Value{NativeType: "numeric", Type: types.Float64, Value: float64(123.45)}, false},
+		{"numeric byte array", "numeric", []uint8{49, 50, 51, 46, 52, 53}, types.Value{NativeType: "numeric", Type: types.Float64, Value: float64(123.45)}, false},
+		{"numeric invalid", "numeric", "abc", types.Value{}, true},
 
 		// String tests
 		{"varchar nil", "varchar", nil, types.Value{NativeType: "varchar", Type: types.String, Value: nil}, false},
@@ -116,6 +130,8 @@ func TestConverterConvertValue(t *testing.T) {
 		// Timestamp tests
 		{"timestamp with time zone nil", "timestamp with time zone", nil, types.Value{NativeType: "timestamp with time zone", Type: types.Timestamp, Value: nil}, false},
 		{"timestamp with time zone time", "timestamp with time zone", testTime, types.Value{NativeType: "timestamp with time zone", Type: types.Timestamp, Value: testTime}, false},
+		{"timestamptz nil", "timestamptz", nil, types.Value{NativeType: "timestamptz", Type: types.Timestamp, Value: nil}, false},
+		{"timestamptz time", "timestamptz", testTime, types.Value{NativeType: "timestamptz", Type: types.Timestamp, Value: testTime}, false},
 
 		// Unsupported type
 		{"unsupported nil", "unsupported", nil, types.Value{}, true},
```

**File**: `provider/postgres_types_test.go` (modified, +28/-0)
```diff
@@ -80,6 +80,34 @@ func NewPostgresTestData(t *testing.T) TestColumnData {
 					assert.True(t, ok, "timestamp with time zone not converted to time.Time")
 				},
 			},
+			{
+				Name:           "timestamptz_col",
+				NativeType:     "timestamptz",
+				ExpectedGoType: fftypes.Timestamp,
+				TestValue:      formattedTime,
+				VerifyFunc: func(t *testing.T, actual any) {
+					_, ok := actual.(time.Time)
+					assert.True(t, ok, "timestamptz not converted to time.Time")
+				},
+			},
+			{
+				Name:           "numeric_col",
+				NativeType:     "numeric",
+				ExpectedGoType: fftypes.Float64,
+				TestValue:      "123.456",
+				VerifyFunc: func(t *testing.T, actual any) {
+					assert.Equal(t, float64(123.456), actual.(float64), "numeric value mismatch")
+				},
+			},
+			{
+				Name:           "integer_col",
+				NativeType:     "int",
+				ExpectedGoType: fftypes.Int32,
+				TestValue:      int32(42),
+				VerifyFunc: func(t *testing.T, actual any) {
+					assert.Equal(t, int32(42), actual.(int32), "int value mismatch")
+				},
+			},
 		},
 	}
 }
```

---

### Incident Patch 4: `ee384957` (2025-04-11)
**Commit Message**: Fix float conversion for Postgres (#1630)

**File**: `provider/postgres.go` (modified, +13/-0)
```diff
@@ -10,6 +10,7 @@ package provider
 import (
 	"database/sql"
 	"fmt"
+	"strconv"
 	"strings"
 	"text/template"
 	"time"
@@ -268,6 +269,18 @@ func (q postgresSQLQueries) castTableItemType(v interface{}, t interface{}) inte
 	case pgBigInt:
 		return int(v.(int64))
 	case pgFloat:
+		// If the column type is NUMERIC, the SQL interface will return the value as
+		// a []uint8 type. This is the ASCII-formatted value of the float, and is
+		// done because the NUMERIC type has arbitrary precision.
+		if byteArray, ok := v.([]uint8); ok {
+			floatVal, err := strconv.ParseFloat(string(byteArray), 64)
+			if err != nil {
+				return nil
+			}
+			return floatVal
+		}
+
+		// Fall back to the original case for actual float64 values
 		return v.(float64)
 	case pgString:
 		return v.(string)
```

**File**: `provider/postgres_test.go` (modified, +6/-0)
```diff
@@ -112,6 +112,12 @@ func TestPostgresCastTableItemType(t *testing.T) {
 			typeSpec: pgFloat,
 			expected: 3.14,
 		},
+		{
+			name:     "pgFloat numeric type conversion",
+			input:    []uint8{49, 57, 49, 46, 56, 51},
+			typeSpec: pgFloat,
+			expected: 191.83,
+		},
 		{
 			name:     "pgString conversion",
 			input:    "hello",
```

---

### Incident Patch 5: `d6f7a4c3` (2025-04-02)
**Commit Message**: Enterprise port: Fix Pydantic and Pyiceberg version issue (#1625)

**File**: `Dockerfile` (modified, +4/-2)
```diff
@@ -88,10 +88,11 @@ FROM python:3.10 AS streamer-builder
 
 WORKDIR /app/streamer
 
+COPY ./streamer/requirements.txt ./streamer/requirements.txt
 RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
     && rm -rf /var/lib/apt/lists/*
 RUN pip install --break-system-packages --upgrade pip
-RUN pip install --break-system-packages boto3 pyarrow 'pyiceberg[glue]'
+RUN pip install --break-system-packages -r ./streamer/requirements.txt
 
 COPY ./streamer/ /app/streamer/
 
@@ -101,11 +102,12 @@ FROM golang:1.22
 WORKDIR /app
 
 # Install Python for the streamer to work
+COPY ./streamer/requirements.txt ./streamer/requirements.txt
 RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip build-essential \
     && rm -rf /var/lib/apt/lists/*
 
 RUN pip install --break-system-packages --upgrade pip
-RUN pip install --break-system-packages boto3 pyarrow 'pyiceberg[glue]'
+RUN pip install --break-system-packages -r ./streamer/requirements.txt
 
 # Copy the Python virtual environment
 COPY --from=streamer-builder /app/streamer /app/streamer
```

**File**: `pytest-requirements.txt` (modified, +2/-1)
```diff
@@ -8,7 +8,8 @@ google-auth
 google-cloud-core
 google-cloud-storage
 pyspark
-pyiceberg
+pydantic<=2.10.6
+pyiceberg[glue]>=0.9.0
 pytest
 pytest-cov
 pytest-mock
```

**File**: `streamer/Dockerfile` (modified, +2/-1)
```diff
@@ -14,7 +14,8 @@ RUN apt-get update && apt-get install -y --no-install-recommends \
 WORKDIR /app
 
 RUN pip install --upgrade pip
-RUN pip install boto3 pyarrow 'pyiceberg[glue]'
+COPY ./streamer/requirements.txt /app/requirements.txt
+RUN pip install -r requirements.txt
 
 ENV PYTHONUNBUFFERED=1
 
```

**File**: `streamer/requirements.txt` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+boto3
+pyarrow
+pydantic<=2.10.6
+pyiceberg[glue]>=0.9.0
\ No newline at end of file
```

---

### Incident Patch 6: `8d9d9c53` (2025-03-13)
**Commit Message**: Add quickstart e2e test (#1594)

**File**: `.github/workflows/testing.yml` (modified, +1/-0)
```diff
@@ -830,6 +830,7 @@ jobs:
           FF_GET_EQUIVALENT_VARIANTS: "true"
           FF_AUTOVARIANT_MICROSEC: "true"
           REDIS_HOST: "172.17.0.1"
+          POSTGRES_HOST: "172.17.0.1"
         run: pytest -vv -s -n 5 --no-cov
 
       - name: Users
```

**File**: `client/src/featureform/deploy.py` (modified, +31/-0)
```diff
@@ -9,6 +9,7 @@
 import platform
 import warnings
 from collections import namedtuple
+from requests.adapters import HTTPAdapter, Retry
 
 import docker
 import requests
@@ -119,12 +120,16 @@ def start(self) -> bool:
             try:
                 print(f"Checking if {config.name} container exists...")
                 container = self._client.containers.get(config.name)
+                print(f'\tContainer {container.name} has status "{container.status}"')
                 if container.status == "running":
                     print(f"\tContainer {config.name} is already running. Skipping...")
                     continue
                 elif container.status == "exited":
                     print(f"\tContainer {config.name} is stopped. Starting...")
                     container.start()
+                elif container.status == "created":
+                    print(f"\tContainer {config.name} is created, but not running. Starting...")
+                    container.start()
             except docker.errors.APIError as e:
                 if e.status_code == 409:
                     print(f"\tContainer {config.name} already exists. Skipping...")
@@ -163,6 +168,31 @@ def start(self) -> bool:
                 else:
                     print(f"\t\t{filename} already exists. Skipping...")
 
+        # We wait for a bit for the Featureform container to be fully running.
+        # We do this by sending a request (with retries), and wait until it's successful (or error after
+        # max tries).
+        session = requests.Session()
+        retries = Retry(
+            total=10,
+            # Total sleep time = {backoff factor} * (2 ** ({number of previous retries}))
+            # https://urllib3.readthedocs.io/en/stable/reference/urllib3.util.html#urllib3.util.Retry
+            backoff_factor=0.2,
+            # request only retries non-server side errors (i.e. non 5xx errors). However,
+            # sometimes Featureform returns a 502 Bad Gateway when it's still initializing.
+            # So we add it to this list of retry-able errors (as well as others, to attempt to
+            # make it less flaky).
+            status_forcelist=[500, 502, 503, 504],
+        )
+        adapter = HTTPAdapter(max_retries=retries)
+        session.mount('http://', adapter)
+
+        try:
+            response = session.get('http://localhost:80', timeout=60)
+            response.raise_for_status()
+        except requests.exceptions.RequestException as e:
+            print("Unable to connect to featureform container: ", e)
+            return False
+
         print("\nFeatureform is now running!")
         print("To access the dashboard, visit http://localhost:80")
 
@@ -174,6 +204,7 @@ def start(self) -> bool:
             print(
                 "To apply definition files, run `featureform apply <file.py> --host http://localhost:7878 --insecure`"
             )
+
         return True
 
     def stop(self) -> bool:
```

**File**: `client/src/featureform/status_display.py` (modified, +1/-7)
```diff
@@ -131,7 +131,6 @@ def get_status_string(self):
 
 
 class StatusDisplayer:
-    did_error: bool = False
     RESOURCE_TYPES_TO_CHECK = {
         FeatureVariant,
         OnDemandFeatureVariant,
@@ -237,12 +236,7 @@ def display(self, host):
                         table_group = Group(*tables)  # Unpack the tables list
                         live.update(table_group, refresh=True)
 
-                    # This block is used for testing
-                    # Tests check for both stderr and an exception
-                    # If we don't throw an exception, then tests will pass even when things fail to register
-                    # We also print all the error messages because the table does not get saved when
-                    # capturing stdout/stderr
-                    if self.verbose and self.did_error:
+                    if len(self.failed_list):
                         statuses = self.create_error_message()
                         sys.tracebacklimit = 0
                         raise Exception("Some resources failed to create\n" + statuses)
```

**File**: `client/tests/test_deploy.py` (modified, +9/-1)
```diff
@@ -70,7 +70,15 @@ def test_deployment_status(deployment, expected_status, request):
         ("docker_quickstart_deployment", False),
     ],
 )
-def test_deployment(deployment, expected_failure, request):
+def test_deployment(deployment, expected_failure, request, mocker):
+    import requests
+
+    mocker.patch("docker.from_env")
+
+    mock_response = mocker.Mock()
+    mock_response.status_code = 200
+    mocker.patch.object(requests.Session, "get", return_value=mock_response)
+
     d = request.getfixturevalue(deployment)
     assert d.start() == (not expected_failure)
     assert d.stop() == (not expected_failure)
```

**File**: `tests/end_to_end/pytest/test_quickstart.py` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+#  This Source Code Form is subject to the terms of the Mozilla Public
+#  License, v. 2.0. If a copy of the MPL was not distributed with this
+#  file, You can obtain one at http://mozilla.org/MPL/2.0/.
+#
+#  Copyright 2024 FeatureForm Inc.
+#
+
+import numpy as np
+import os
+
+from contextlib import redirect_stdout
+from featureform.cli import cli
+
+QUICKSTART_FILES_BASE_DIR = '../../../quickstart/static_files'
+
+def test_quickstart(ff_client, monkeypatch):
+    # Setting the environment variable without setting it globally,
+    # which may impact other tests.
+    monkeypatch.setenv('FEATUREFORM_HOST', 'localhost:7878')
+
+    # Call into Featureform as you would from the CLI.
+    cli.main(
+        args=[
+            'apply',
+            os.path.join(QUICKSTART_FILES_BASE_DIR, 'definitions.py'),
+            '--insecure',
+            '--verbose'
+        ],
+        standalone_mode=False
+    )
+
+    # Make sure that the provided quickstart files don't throw an exception.
+    # There's a lot of output written by these files, which are unnecessary in the test logs,
+    # so we ignore stdout.
+    with redirect_stdout(open(os.devnull, 'w')):
+        with open(os.path.join(QUICKSTART_FILES_BASE_DIR, 'serving.py')) as f:
+            exec(f.read())
+        with open(os.path.join(QUICKSTART_FILES_BASE_DIR, 'training.py')) as f:
+            exec(f.read())
+
+    # Separately test features and training sets.
+    feature_value = ff_client.features(
+        [("avg_transactions", "quickstart")],
+        {"user": "C1214240"}
+    )
+    np.testing.assert_allclose(feature_value, [319.0])
+
+    dataset = ff_client.training_set(
+        "fraud_training",
+        "quickstart"
+    )
+    # Just confirm that there are some values being returned.
+    # If the enumerator is empty, it will raise a StopIteration exception.
+    next(dataset)
\ No newline at end of file
```

---

### Incident Patch 7: `575a1b66` (2025-03-12)
**Commit Message**: Update Docker build action runner (#1607)

**File**: `.github/workflows/publish-docker-images.yml` (modified, +12/-12)
```diff
@@ -26,7 +26,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -74,7 +74,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -109,7 +109,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -144,7 +144,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -179,7 +179,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -214,7 +214,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -249,7 +249,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -284,7 +284,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -319,7 +319,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -354,7 +354,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -389,7 +389,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
@@ -424,7 +424,7 @@ jobs:
     defaults:
       run:
         working-directory: ./
-    runs-on: ubuntu-latest
+    runs-on: DockerBuild
     steps:
       - uses: actions/checkout@v2
 
```

---

### Incident Patch 8: `993ad105` (2025-03-10)
**Commit Message**: Adds custom ClickHouse quickstart flow (#1610)

**File**: `client/src/featureform/cli.py` (modified, +3/-3)
```diff
@@ -257,14 +257,14 @@ def search(query, host, cert, insecure):
     "--quickstart", is_flag=True, help="Install Featureform Quickstart as well"
 )
 @click.option(
-    "--include_clickhouse",
+    "--clickhouse",
     is_flag=True,
     help="Includes ClickHouse in the deployment. Requires quickstart.",
 )
-def deploy(deploy_type, quickstart, include_clickhouse):
+def deploy(deploy_type, quickstart, clickhouse):
     print(f"Deploying Featureform on {deploy_type.capitalize()}")
     if deploy_type.lower() == "docker":
-        deployment = DockerDeployment(quickstart, clickhouse=include_clickhouse)
+        deployment = DockerDeployment(quickstart, clickhouse=clickhouse)
     else:
         supported_types = ", ".join(SUPPORTED_DEPLOY_TYPES)
         raise ValueError(
```

**File**: `client/src/featureform/deploy.py` (modified, +7/-2)
```diff
@@ -50,9 +50,14 @@ class DockerDeployment(Deployment):
     def __init__(self, quickstart: bool, clickhouse: bool = False):
         super().__init__(quickstart)
 
+        definitions_file = (
+            "https://featureform-demo-files.s3.us-east-1.amazonaws.com/clickhouse/definitions.py" if clickhouse
+            else "https://featureform-demo-files.s3.amazonaws.com/definitions.py"
+        )
+
         self._quickstart_directory = "quickstart"
         self._quickstart_files = [
-            "https://featureform-demo-files.s3.amazonaws.com/definitions.py",
+            definitions_file,
             "https://featureform-demo-files.s3.amazonaws.com/serving.py",
             "https://featureform-demo-files.s3.amazonaws.com/training.py",
         ]
@@ -96,7 +101,7 @@ def __init__(self, quickstart: bool, clickhouse: bool = False):
             quickstart_deployment.append(
                 DOCKER_CONFIG(
                     name="quickstart-clickhouse",
-                    image="clickhouse/clickhouse-server",
+                    image="featureformcom/quickstart-clickhouse",
                     port={"9000/tcp": 9000, "8123/tcp": 8123},
                     detach_mode=True,
                     env={},
```

**File**: `quickstart/images/clickhouse/Dockerfile` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+FROM clickhouse/clickhouse-server:latest
+
+RUN mkdir -p /docker-entrypoint-initdb.d
+COPY quickstart/transactions_truncated.csv /docker-entrypoint-initdb.d/transactions.csv
+COPY quickstart/images/clickhouse/init.sql /docker-entrypoint-initdb.d/init.sql
+
+RUN chmod -R 755 /docker-entrypoint-initdb.d
```

**File**: `quickstart/images/clickhouse/init.sql` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+CREATE TABLE transactions (
+  TransactionID        TEXT,
+  CustomerID           TEXT NOT NULL,
+  CustomerDOB          DATE,
+  CustLocation         TEXT,
+  CustAccountBalance   NUMERIC(12,2),
+  TransactionAmount    NUMERIC(12,2),
+  "Timestamp"          DATETIME,
+  IsFraud              BOOLEAN,
+)
+ENGINE MergeTree()
+PRIMARY KEY TransactionID;
+
+CREATE TEMPORARY TABLE staging_transactions (
+  TransactionID       TEXT,
+  CustomerID          TEXT,
+  CustomerDOB         TEXT,
+  CustLocation        TEXT,
+  CustAccountBalance  NUMERIC(12,2),
+  TransactionAmount   NUMERIC(12,2),
+  "Timestamp"         TEXT,
+  IsFraud             TEXT
+);
+
+INSERT INTO staging_transactions FROM INFILE '/docker-entrypoint-initdb.d/transactions.csv' FORMAT CSV;
+
+INSERT INTO transactions (
+  TransactionID,
+  CustomerID,
+  CustomerDOB,
+  CustLocation,
+  CustAccountBalance,
+  TransactionAmount,
+  "Timestamp",
+  IsFraud
+)
+SELECT
+  TransactionID,
+  CustomerID,
+  CASE
+    -- If DOB matches pattern DD/MM/YY, parse it:
+    WHEN match(CustomerDOB,'^[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}$') THEN
+      CASE
+        WHEN parseDateTimeBestEffort(CustomerDOB) > today()
+          THEN parseDateTimeBestEffort(CustomerDOB) - INTERVAL '100 years'
+        ELSE parseDateTimeBestEffort(CustomerDOB)
+      END
+    ELSE
+      -- If DOB is 'NaN', '.', empty, or doesn't match pattern, store NULL
+      NULL
+  END
+    AS parsed_DOB,
+  CustLocation,
+  CustAccountBalance,
+  TransactionAmount,
+  -- Example format: "2022-04-12 12:52:20 UTC"
+  -- Parse with to_timestamp, then treat as UTC
+  parseDateTimeBestEffort("Timestamp")
+    AS parsed_timestamp,
+  CASE
+    WHEN lower(IsFraud) = 'true'  THEN true
+    WHEN lower(IsFraud) = 'false' THEN false
+    ELSE false
+  END
+    AS parsed_fraud
+FROM staging_transactions;
+
+DROP TABLE staging_transactions;
\ No newline at end of file
```

**File**: `quickstart/static_files/clickhouse/definitions.py` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import featureform as ff
+
+
+clickhouse = ff.register_clickhouse(
+    name="clickhouse-quickstart",
+    host="172.17.0.1",  # The default Docker gateway address
+    port=9000,
+    user="default",
+    password="",
+    database="default",
+)
+
+
+redis = ff.register_redis(
+    name="redis-quickstart",
+    host="172.17.0.1",  # The default Docker gateway address
+    port=6379,
+)
+
+
+transactions = clickhouse.register_table(
+    name="transactions",
+    table="transactions",  # This is the table's name in ClickHouse
+)
+
+
+@clickhouse.sql_transformation(inputs=[transactions])
+def average_user_transaction(tr):
+    return (
+        "SELECT CustomerID as user_id, avg(TransactionAmount) "
+        "as avg_transaction_amt from {{tr}} GROUP BY user_id"
+    )
+
+
+@ff.entity
+class User:
+    avg_transactions = ff.Feature(
+        average_user_transaction[
+            ["user_id", "avg_transaction_amt"]
+        ],  # We can optional include the `timestamp_column` "timestamp" here
+        variant="quickstart",
+        type=ff.Float32,
+        inference_store=redis,
+    )
+
+    fraudulent = ff.Label(
+        transactions[["CustomerID", "IsFraud"]], 
+        variant="quickstart", 
+        type=ff.Bool,
+    )
+
+
+ff.register_training_set(
+    name="fraud_training",
+    label=User.fraudulent,
+    features=[User.avg_transactions],
+    variant="quickstart",
+)
+
+
+
```

**File**: `quickstart/static_files/definitions.py` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+import featureform as ff
+
+
+postgres = ff.register_postgres(
+    name="postgres-quickstart",
+    host="172.17.0.1",  # The default Docker gateway address
+    port="5432",
+    user="postgres",
+    password="password",
+    database="postgres",
+)
+
+
+redis = ff.register_redis(
+    name="redis-quickstart",
+    host="172.17.0.1",  # The default Docker gateway address
+    port=6379,
+)
+
+
+transactions = postgres.register_table(
+    name="transactions",
+    table="transactions",  # This is the table's name in Postgres
+)
+
+
+@postgres.sql_transformation(inputs=[transactions])
+def average_user_transaction(tr):
+    return (
+        "SELECT CustomerID as user_id, avg(TransactionAmount) "
+        "as avg_transaction_amt from {{tr}} GROUP BY user_id"
+    )
+
+
+@ff.entity
+class User:
+    avg_transactions = ff.Feature(
+        average_user_transaction[
+            ["user_id", "avg_transaction_amt"]
+        ],  # We can optional include the `timestamp_column` "timestamp" here
+        variant="quickstart",
+        type=ff.Float32,
+        inference_store=redis,
+    )
+
+    fraudulent = ff.Label(
+        transactions[["customerid", "isfraud"]], 
+        variant="quickstart", 
+        type=ff.Bool,
+    )
+
+
+ff.register_training_set(
+    name="fraud_training",
+    label=User.fraudulent,
+    features=[User.avg_transactions],
+    variant="quickstart",
+)
+
+
+
```

**File**: `quickstart/static_files/serving.py` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+from featureform import Client
+
+serving = Client(insecure=True)
+
+transformation_name = "avg_transactions"
+transformation_variant = "quickstart"
+
+user_feat = serving.features(
+    [(transformation_name, transformation_variant)], 
+    {"user": "C1214240"}
+)
+print(f"User Result: {user_feat}")
```

**File**: `quickstart/static_files/training.py` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+from featureform import Client
+
+client = Client(insecure=True)
+
+ts_name = "fraud_training"
+ts_variant = "quickstart"
+
+dataset = client.training_set(ts_name, ts_variant)
+
+for i, batch in enumerate(dataset):
+    print(batch)
```

---

### Incident Patch 9: `47b8a2bf` (2025-03-03)
**Commit Message**: Hotfix: removes remaining references to Meilisearch (#1861) (#1605)

Co-authored-by: Riddhi Bagadiaa <[REDACTED_EMAIL]>

**File**: `.github/workflows/testing.yml` (modified, +0/-11)
```diff
@@ -145,7 +145,6 @@ jobs:
             ,testing/bigquery
             ,testing/gcs
             ,testing/redis
-            ,testing/meilisearch
             ,testing/pinecone
             ,testing/cassandra
           parse-json-secrets: true
@@ -190,13 +189,6 @@ jobs:
       - name: Unit Tests
         run: go test ./... -short
 
-      - name: Install Search Container
-        run: docker pull getmeili/meilisearch:v1.0
-
-      - name: Start Search
-        run: |
-          docker run -d -p $MEILISEARCH_PORT:7700 getmeili/meilisearch:v1.0
-
       - uses: getong/redis-action@v1
         with:
           host port: 6378
@@ -475,7 +467,6 @@ jobs:
             ,testing/bigquery
             ,testing/gcs
             ,testing/redis
-            ,testing/meilisearch
             ,testing/pinecone
             ,testing/cassandra
           parse-json-secrets: true
@@ -638,7 +629,6 @@ jobs:
             ,testing/bigquery
             ,testing/gcs
             ,testing/redis
-            ,testing/meilisearch
             ,testing/pinecone
             ,testing/cassandra
           parse-json-secrets: true
@@ -803,7 +793,6 @@ jobs:
             ,testing/bigquery
             ,testing/gcs
             ,testing/redis
-            ,testing/meilisearch
             ,testing/pinecone
             ,testing/cassandra
           parse-json-secrets: true
```

**File**: `Dockerfile` (modified, +0/-3)
```diff
@@ -121,9 +121,6 @@ RUN curl -sL https://deb.nodesource.com/setup_18.x | sh
 RUN apt-get update
 RUN apt-get install -y nodejs
 
-# Install MeiliSearch
-# RUN curl -L https://install.meilisearch.com | sh
-
 # Install goose for migrations
 RUN go install github.com/pressly/goose/v3/cmd/goose@v3.18.0
 
```

**File**: `charts/featureform/Chart.lock` (modified, +2/-5)
```diff
@@ -2,8 +2,5 @@ dependencies:
 - name: ingress-nginx
   repository: https://kubernetes.github.io/ingress-nginx
   version: 4.1.0
-- name: meilisearch
-  repository: https://meilisearch.github.io/meilisearch-kubernetes
-  version: 0.1.49
-digest: sha256:e92e6d0d55ad21d24ebcbbb3e06ed9a0db26a38f9a8ce0b777656d093480eb06
-generated: "2023-03-04T11:08:43.374076-08:00"
+digest: sha256:c9d0e06078c64e195b2dac589283bbac8070ce54fadbbf8a950812922a1c5e6b
+generated: "2025-02-28T15:24:59.44073-08:00"
```

**File**: `charts/featureform/Chart.yaml` (modified, +0/-4)
```diff
@@ -36,7 +36,3 @@ dependencies:
       - ingress-nginx
     version: 4.1.0
     condition: nginx.enabled
-
-  - name: meilisearch
-    repository: https://meilisearch.github.io/meilisearch-kubernetes
-    version: 0.1.49
```

**File**: `charts/featureform/templates/dashboard-metadata/deployment.yaml` (modified, +0/-6)
```diff
@@ -41,12 +41,6 @@ spec:
               value: {{ .Values.metadata.port | quote }}
             - name: METADATA_HTTP_PORT
               value: {{ .Values.dashboardmetadata.port | quote }}
-            - name: MEILISEARCH_PORT
-              value: {{ .Values.meilisearch.port | quote }}
-            - name: MEILISEARCH_HOST
-              value: {{ .Values.meilisearch.host }}
-            - name: MEILISEARCH_APIKEY
-              value: {{ .Values.meilisearch.apikey | quote }}
             - name: FEATUREFORM_DEBUG_LOGGING
               value: {{ .Values.debug | quote }}
             - name: FEATUREFORM_VERSION
```

**File**: `charts/featureform/templates/metadata/deployment.yaml` (modified, +0/-6)
```diff
@@ -42,12 +42,6 @@ spec:
             - containerPort: 8080
           resources: {}
           env:
-            - name: MEILISEARCH_PORT
-              value: {{ .Values.meilisearch.port | quote }}
-            - name: MEILISEARCH_HOST
-              value: {{ .Values.meilisearch.host }}
-            - name: MEILISEARCH_APIKEY
-              value: {{ .Values.meilisearch.apikey | quote }}
             - name: FF_STATE_PROVIDER
               value: {{ .Values.stateProvider | quote }}
             - name: FEATUREFORM_DEBUG_LOGGING
```

**File**: `charts/featureform/values.yaml` (modified, +0/-7)
```diff
@@ -95,13 +95,6 @@ searchjob:
   image:
     name: "search-loader"
 
-# These values override the values in the 3rd party meilisearch chart
-meilisearch:
-  fullnameOverride: featureform-search
-  port: 7700
-  host: featureform-search
-  apikey: ""
-
 prometheus:
   port: 9090
   replicaCount: 1
```

**File**: `dashboard/package.json` (modified, +1/-2)
```diff
@@ -22,7 +22,6 @@
     "immer": "9.0.15",
     "jspdf": "2.5.1",
     "jspdf-autotable": "3.5.28",
-    "meilisearch": "0.31.1",
     "next": "12.2.5",
     "prometheus-query": "3.2.5",
     "react": "18.3.1",
@@ -87,4 +86,4 @@
     "run-script-os": "1.1.6",
     "typescript": "3.9.7"
   }
-}
+}
\ No newline at end of file
```

---

### Incident Patch 10: `56bce9f4` (2025-03-01)
**Commit Message**: Hotfix: fixes deletion for snowflake and dynamo tables (#1860) (#1604)

**File**: `main/main.go` (modified, +4/-3)
```diff
@@ -153,9 +153,10 @@ func main() {
 	}
 
 	sconfig := coordinator.SchedulerConfig{
-		TaskPollInterval:       1 * time.Second,
-		TaskStatusSyncInterval: 1 * time.Minute,
-		DependencyPollInterval: 1 * time.Second,
+		TaskPollInterval:         1 * time.Second,
+		TaskStatusSyncInterval:   1 * time.Minute,
+		DependencyPollInterval:   1 * time.Second,
+		TaskDistributionInterval: 1,
 	}
 	hostname, err := os.Hostname()
 	if err != nil {
```

**File**: `provider/dynamodb.go` (modified, +29/-2)
```diff
@@ -298,6 +298,24 @@ func (store *dynamodbOnlineStore) getFromMetadataTable(tablename string) (*dynam
 	return tableMeta, nil
 }
 
+func (store *dynamodbOnlineStore) deleteFromMetadataTable(ctx context.Context, tablename string) error {
+	input := &dynamodb.DeleteItemInput{
+		TableName: aws.String(defaultMetadataTableName),
+		Key: map[string]types.AttributeValue{
+			"Tablename": &types.AttributeValueMemberS{
+				Value: tablename,
+			},
+		},
+	}
+	_, err := store.client.DeleteItem(ctx, input)
+	if err != nil {
+		wrappedErr := fferr.NewExecutionError(pt.DynamoDBOnline.String(), err)
+		wrappedErr.AddDetail("tablename", tablename)
+		return wrappedErr
+	}
+	return nil
+}
+
 func formatDynamoTableName(prefix, feature, variant string) string {
 	tablename := fmt.Sprintf("%s__%s__%s", sn.Custom(prefix, "[^a-zA-Z0-9_]"), sn.Custom(feature, "[^a-zA-Z0-9_]"), sn.Custom(variant, "[^a-zA-Z0-9_]"))
 	return sn.Custom(tablename, "[^a-zA-Z0-9_.\\-]")
@@ -359,19 +377,28 @@ func (store *dynamodbOnlineStore) CreateTable(feature, variant string, valueType
 }
 
 func (store *dynamodbOnlineStore) DeleteTable(feature, variant string) error {
+	logger := store.logger.WithResource(logging.FeatureVariant, feature, variant)
+	tableName := formatDynamoTableName(store.prefix, feature, variant)
+	logger.Debugw("Deleting feature table from DynamoDB ...", "tablename", tableName)
 	params := &dynamodb.DeleteTableInput{
-		TableName: aws.String(formatDynamoTableName(store.prefix, feature, variant)),
+		TableName: aws.String(tableName),
 	}
 	_, err := store.client.DeleteTable(context.TODO(), params)
 	if err != nil {
 		var notFoundErr *types.ResourceNotFoundException
 		if errors.As(err, &notFoundErr) {
+			logger.Errorw("Table not found", "err", err)
 			return fferr.NewDatasetNotFoundError(feature, variant, err)
 		} else {
+			logger.Errorw("Failed to delete feature table from DynamoDB", "err", err)
 			return fferr.NewExecutionError(pt.DynamoDBOnline.String(), err)
 		}
 	}
-
+	if err := store.deleteFromMetadataTable(context.TODO(), tableName); err != nil {
+		logger.Errorw("Failed to delete feature table from DynamoDB metadata table", "err", err)
+		return err
+	}
+	logger.Debugw("Successfully deleted feature table from DynamoDB")
 	return nil
 }
 
```

**File**: `provider/snowflake.go` (modified, +45/-13)
```diff
@@ -375,28 +375,60 @@ func (sf *snowflakeOfflineStore) AsOfflineStore() (OfflineStore, error) {
 
 func (sf snowflakeOfflineStore) Delete(location pl.Location) error {
 	logger := sf.logger.With("location", location.Location())
-	if exists, err := sf.sqlOfflineStore.tableExists(location); err != nil {
+
+	logger.Debug("Deleting table ...")
+	sqlLoc, ok := location.(*pl.SQLLocation)
+	if !ok {
+		logger.Errorw("Location is not an SQL location", "location_type", fmt.Sprintf("%T", location))
+		return fferr.NewInternalErrorf("location is not an SQL location")
+	}
+	logger.Debug("Checking if table exists ...")
+	exists, err := sf.sqlOfflineStore.checkExists(sqlLoc)
+	if err != nil {
 		logger.Errorw("Failed to check if table exists", "error", err)
 		return err
-	} else if !exists {
+	}
+	if !exists {
 		logger.Errorw("Table does not exist")
 		return fferr.NewDatasetLocationNotFoundError(location.Location(), nil)
 	}
 
-	sqlLoc, isSqlLoc := location.(*pl.SQLLocation)
-	if !isSqlLoc {
-		logger.Errorw("Location is not an SQL location", "location_type", fmt.Sprintf("%T", location))
-		return fferr.NewInternalErrorf("location is not an SQL location")
+	queries := []string{
+		sf.sfQueries.dropTableQuery(*sqlLoc),
+		sf.sfQueries.dropViewQuery(*sqlLoc),
 	}
 
-	query := sf.sfQueries.dropTableQuery(*sqlLoc)
-	logger.Debugw("Dropping table", "query", query)
-	if _, err := sf.db.Exec(query); err != nil {
-		logger.Errorw("Failed to drop table", "error", err)
-		return sf.handleErr(fferr.NewExecutionError(pt.SnowflakeOffline.String(), err), err)
+	var (
+		dropSuccessful bool
+		errs           []error
+	)
+	logger.Debugw("Running drop queries", "queries", queries)
+	for _, q := range queries {
+		logger.Debugw("Executing drop query", "query", q)
+		if _, err := sf.db.Exec(q); err != nil {
+			logger.Errorw("Failed to execute drop query", "query", q, "error", err)
+			handledErr := sf.handleErr(fferr.NewExecutionError(pt.SnowflakeOffline.String(), err), err)
+			errs = append(errs, handledErr)
+			continue
+		} else {
+			logger.Debugw("Successfully executed drop query", "query", q)
+			dropSuccessful = true
+			break
+		}
 	}
-	logger.Info("Successfully dropped table")
-	return nil
+
+	if dropSuccessful && len(errs) < 2 {
+		logger.Infow("Successfully dropped table", "table", sqlLoc)
+		return nil
+	}
+
+	if len(errs) > 0 {
+		logger.Errorw("Failed to drop table", "errors", errs)
+		return fferr.NewInternalErrorf("failed to drop table")
+	}
+
+	logger.Errorw("Failed to drop table due to unknown errors")
+	return fferr.NewExecutionError(pt.SnowflakeOffline.String(), fmt.Errorf("failed to drop table due to errors"))
 }
 
 // handleErr attempts to add the Snowflake query and session IDs to a wrapped error to aid
```

**File**: `provider/snowflake_queries.go` (modified, +5/-0)
```diff
@@ -121,6 +121,11 @@ func (q snowflakeSQLQueries) dropTableQuery(loc pl.SQLLocation) string {
 	return fmt.Sprintf("DROP TABLE %s", SanitizeSqlLocation(obj))
 }
 
+func (q snowflakeSQLQueries) dropViewQuery(loc pl.SQLLocation) string {
+	obj := loc.TableLocation()
+	return fmt.Sprintf("DROP VIEW %s", SanitizeSqlLocation(obj))
+}
+
 func SanitizeSnowflakeIdentifier(obj pl.FullyQualifiedObject) string {
 	ident := db.Identifier{}
 
```

---

### Incident Patch 11: `effcde3f` (2025-02-28)
**Commit Message**: Bugfix: DynamoDB fails to complete materialization due to throttling errors (#1602)

**File**: `charts/featureform/templates/coordinator/deployment.yaml` (modified, +2/-0)
```diff
@@ -49,6 +49,8 @@ spec:
               value: {{ .Values.k8sRunnerEnable | quote }}
             - name: WORKER_IMAGE
               value: "{{ .Values.repository  }}/worker:{{ .Values.versionOverride | default .Chart.AppVersion }}"
+            - name: MATERIALIZATION_WORKER_POOL_SIZE
+              value: {{ .Values.coordinator.execution.materializationWorkerPoolSize | quote }}
             - name: PANDAS_RUNNER_IMAGE
               value: "{{ .Values.repository | default .Values.repository }}/k8s_runner:{{ .Values.versionOverride | default .Chart.AppVersion }}"
             - name: DEBUG
```

**File**: `charts/featureform/values.yaml` (modified, +1/-0)
```diff
@@ -158,6 +158,7 @@ coordinator:
     taskPollInterval: "1m"
     taskStatusSyncInterval: "1h"
     taskDependencyPollInterval: "1m"
+    materializationWorkerPoolSize: 30
 
 # Configuration for the Dashboard frontend
 dashboard:
```

**File**: `config/config.go` (modified, +4/-0)
```diff
@@ -329,3 +329,7 @@ type FeatureformApp struct {
 	// This will only be set when StateProviderType is PostgresStateProvider
 	Postgres *postgres.Config
 }
+
+func GetMaterializationWorkerPoolSize() int {
+	return helpers.GetEnvInt("MATERIALIZATION_WORKER_POOL_SIZE", 30)
+}
```

**File**: `provider/dynamodb.go` (modified, +87/-74)
```diff
@@ -12,14 +12,14 @@ import (
 	"encoding/json"
 	"errors"
 	"fmt"
-	"math"
 	"reflect"
 	"strconv"
 	"time"
 
 	pl "github.com/featureform/provider/location"
 
 	"github.com/araddon/dateparse"
+	re "github.com/avast/retry-go/v4"
 	"github.com/aws/aws-sdk-go-v2/aws"
 	"github.com/aws/aws-sdk-go-v2/aws/ratelimit"
 	"github.com/aws/aws-sdk-go-v2/aws/retry"
@@ -28,33 +28,29 @@ import (
 	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
 	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
 	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
+	"github.com/aws/smithy-go"
 	"github.com/featureform/fferr"
 	"github.com/featureform/logging"
 	pc "github.com/featureform/provider/provider_config"
 	pt "github.com/featureform/provider/provider_type"
 	se "github.com/featureform/provider/serialization"
 	vt "github.com/featureform/provider/types"
 	sn "github.com/mrz1836/go-sanitize"
-	"go.uber.org/zap"
 )
 
-const defaultMetadataTableName = "FeatureformMetadata"
-
 func init() {
 	if _, ok := serializers[dynamoSerializationVersion]; !ok {
 		panic("Dynamo serializer not implemented")
 	}
 }
 
-const (
-	// Serialization version to use for new tables
-	dynamoSerializationVersion = serializeV1
-)
-
 const (
 	// Default timeout when waiting for dynamoDB tables to be ready
 	defaultDynamoTableTimeout = 30 * time.Second
-	maxRetries                = 5
+	// Serialization version to use for new tables
+	dynamoSerializationVersion = serializeV1
+	defaultMetadataTableName   = "FeatureformMetadata"
+	dynamoDBThrottleErrorCode  = "ThrottlingException"
 )
 
 type dynamodbTableKey struct {
@@ -78,7 +74,7 @@ type dynamodbOnlineStore struct {
 	prefix string
 	BaseProvider
 	timeout            time.Duration
-	logger             *zap.SugaredLogger
+	logger             logging.Logger
 	accessKey          string
 	secretKey          string
 	region             string
@@ -146,6 +142,7 @@ func NewDynamodbOnlineStore(options *pc.DynamodbConfig) (*dynamodbOnlineStore, e
 		config.WithRetryer(func() aws.Retryer {
 			return retry.AddWithMaxBackoffDelay(retry.NewStandard(func(o *retry.StandardOptions) {
 				o.RateLimiter = ratelimit.None
+				o.MaxAttempts = 25
 			}), defaultDynamoTableTimeout)
 		}),
 	}
@@ -179,14 +176,21 @@ func NewDynamodbOnlineStore(options *pc.DynamodbConfig) (*dynamodbOnlineStore, e
 	}
 	logger := logging.NewLogger("dynamodb")
 	tags := toDynamoDBTags(options.Tags)
-	if err := CreateMetadataTable(client, logger.SugaredLogger, tags); err != nil {
+	if err := CreateMetadataTable(client, logger, tags); err != nil {
 		return nil, err
 	}
-	return &dynamodbOnlineStore{client, options.Prefix, BaseProvider{
-		ProviderType:   pt.DynamoDBOnline,
-		ProviderConfig: options.Serialized(),
-	}, defaultDynamoTableTimeout, logger.SugaredLogger,
-		accessKey, secretKey, options.Region, options.StronglyConsistent, tags,
+	return &dynamodbOnlineStore{client, options.Prefix,
+		BaseProvider{
+			ProviderType:   pt.DynamoDBOnline,
+			ProviderConfig: options.Serialized(),
+		},
+		defaultDynamoTableTimeout,
+		logger,
+		accessKey,
+		secretKey,
+		options.Region,
+		options.StronglyConsistent,
+		tags,
 	}, nil
 }
 
@@ -200,7 +204,7 @@ func (store *dynamodbOnlineStore) Close() error {
 }
 
 // TODO(simba) make table name a param
-func CreateMetadataTable(client *dynamodb.Client, logger *zap.SugaredLogger, tags []types.Tag) error {
+func CreateMetadataTable(client *dynamodb.Client, logger logging.Logger, tags []types.Tag) error {
 	tableName := defaultMetadataTableName
 	params := &dynamodb.CreateTableInput{
 		TableName: aws.String(tableName),
@@ -300,12 +304,16 @@ func formatDynamoTableName(prefix, feature, variant string) string {
 }
 
 func (store *dynamodbOnlineStore) GetTable(feature, variant string) (OnlineStoreTable, error) {
+	logger := store.logger.WithResource(logging.FeatureVariant, feature, variant)
 	key := dynamodbTableKey{store.prefix, feature, variant}
+	logger.Debugw("Getting feature table from DynamoDB metadata table ...", "key", key)
 	meta, err := store.getFromMetadataTable(formatDynamoTableName(store.prefix, feature, variant))
 	if err != nil {
+		logger.Errorw("Failed to get feature table from DynamoDB metadata table", "err", err)
 		return nil, fferr.NewDatasetNotFoundError(feature, variant, err)
 	}
 	table := &dynamodbOnlineTable{client: store.client, key: key, valueType: meta.Valuetype, version: meta.Version, stronglyConsistent: store.stronglyConsistent}
+	logger.Debugw("Successfully got feature table from DynamoDB metadata table")
 	return table, nil
 }
 
@@ -385,56 +393,76 @@ func (store dynamodbOnlineStore) Delete(location pl.Location) error {
 // maxDynamoBatchSize is the max amount of items that can be written to Dynamo at once. It's a dynamo set limitation.
 const maxDynamoBatchSize = 25
 
-func (table dynamodbOnlineTable) BatchSet(items []SetItem) error {
+func (table dynamodbOnlineTable) BatchSet(ctx context.Context, items []SetItem) error {
+	logger := logging.GetLoggerFromContext(ctx
```

**File**: `provider/dynamodb_test.go` (modified, +0/-46)
```diff
@@ -359,49 +359,3 @@ func TestFailDeserializeV1(t *testing.T) {
 		})
 	}
 }
-
-func Test_exponentialBackoff(t *testing.T) {
-	maxTime := defaultDynamoTableTimeout
-
-	tests := []struct {
-		name        string
-		attempt     int
-		totalWaited time.Duration
-		wantWait    time.Duration
-		wantTotal   time.Duration
-	}{
-		{
-			name:        "first attempt, no prior wait",
-			attempt:     0,
-			totalWaited: 0,
-			wantWait:    1 * time.Second,
-			wantTotal:   1 * time.Second,
-		},
-		{
-			name:        "second attempt, after 1 second",
-			attempt:     1,
-			totalWaited: 1 * time.Second,
-			wantWait:    2 * time.Second,
-			wantTotal:   3 * time.Second,
-		},
-		{
-			name:        "exceeds default timeout",
-			attempt:     4,
-			totalWaited: maxTime - 1*time.Second,
-			wantWait:    1 * time.Second, // We have 1 second of "room" left before hitting the timeout
-			wantTotal:   maxTime,
-		},
-	}
-
-	for _, tt := range tests {
-		t.Run(tt.name, func(t *testing.T) {
-			gotWait, gotTotal := exponentialBackoff(tt.attempt, tt.totalWaited)
-			if gotWait != tt.wantWait {
-				t.Errorf("exponentialBackoff() gotWait = %v, want %v", gotWait, tt.wantWait)
-			}
-			if gotTotal != tt.wantTotal {
-				t.Errorf("exponentialBackoff() gotTotal = %v, want %v", gotTotal, tt.wantTotal)
-			}
-		})
-	}
-}
```

**File**: `provider/firestore.go` (modified, +6/-5)
```diff
@@ -12,11 +12,13 @@
 package provider
 
 import (
-	"cloud.google.com/go/firestore"
 	"context"
 	"encoding/json"
 	"errors"
 	"fmt"
+	"time"
+
+	"cloud.google.com/go/firestore"
 	"github.com/featureform/fferr"
 	"github.com/featureform/logging"
 	pl "github.com/featureform/provider/location"
@@ -29,7 +31,6 @@ import (
 	"google.golang.org/api/option"
 	"google.golang.org/grpc/codes"
 	"google.golang.org/grpc/status"
-	"time"
 )
 
 const (
@@ -361,7 +362,7 @@ func (store *firestoreOnlineStore) Delete(location pl.Location) error {
 
 func (table firestoreOnlineTable) Set(entity string, value interface{}) error {
 	// Set is just a special case of batch writing.
-	err := table.BatchSet([]SetItem{{
+	err := table.BatchSet(context.Background(), []SetItem{{
 		Entity: entity,
 		Value:  value,
 	}})
@@ -399,13 +400,13 @@ const maxFirestoreBatchSize = 20
 
 func (table firestoreOnlineTable) MaxBatchSize() (int, error) { return maxFirestoreBatchSize, nil }
 
-func (table firestoreOnlineTable) BatchSet(items []SetItem) error {
+func (table firestoreOnlineTable) BatchSet(ctx context.Context, items []SetItem) error {
 	if len(items) > maxFirestoreBatchSize {
 		return fferr.NewInternalErrorf(
 			"Cannot batch write %d items.\nMax: %d\n", len(items), maxFirestoreBatchSize)
 	}
 
-	bulkWriter := table.client.BulkWriter(context.TODO())
+	bulkWriter := table.client.BulkWriter(ctx)
 
 	for _, item := range items {
 		serializedValue, err := table.serializer.Serialize(table.valueType, item.Value)
```

**File**: `provider/online.go` (modified, +2/-1)
```diff
@@ -8,6 +8,7 @@
 package provider
 
 import (
+	"context"
 	"fmt"
 
 	pl "github.com/featureform/provider/location"
@@ -65,7 +66,7 @@ type VectorStoreTable interface {
 
 type BatchOnlineTable interface {
 	OnlineStoreTable
-	BatchSet([]SetItem) error
+	BatchSet(ctx context.Context, items []SetItem) error
 	MaxBatchSize() (int, error)
 }
 
```

**File**: `provider/online_test.go` (modified, +4/-3)
```diff
@@ -7,6 +7,7 @@
 package provider
 
 import (
+	"context"
 	"encoding/json"
 	"fmt"
 	"io/ioutil"
@@ -152,7 +153,7 @@ func testBatchSetGetEntity(t *testing.T, store OnlineStore) {
 	singleEnt := "e"
 	singleVal := "val"
 	singleSet := []SetItem{{singleEnt, singleVal}}
-	if err := batchTable.BatchSet(singleSet); err != nil {
+	if err := batchTable.BatchSet(context.Background(), singleSet); err != nil {
 		t.Fatalf("Failed to set single entity: %s", err)
 	}
 	gotVal, err := tab.Get(singleEnt)
@@ -168,7 +169,7 @@ func testBatchSetGetEntity(t *testing.T, store OnlineStore) {
 		value := fmt.Sprintf("value_%d", i)
 		maxSet[i] = SetItem{entity, value}
 	}
-	if err := batchTable.BatchSet(maxSet); err != nil {
+	if err := batchTable.BatchSet(context.Background(), maxSet); err != nil {
 		t.Fatalf("Failed to set multi entity: %s", err)
 	}
 	for _, item := range maxSet {
@@ -182,7 +183,7 @@ func testBatchSetGetEntity(t *testing.T, store OnlineStore) {
 		}
 	}
 	overSizedSet := append(maxSet, SetItem{"a", "b"})
-	if err := batchTable.BatchSet(overSizedSet); err == nil {
+	if err := batchTable.BatchSet(context.Background(), overSizedSet); err == nil {
 		t.Fatalf("Succeeded to batch set over max size")
 	}
 }
```

---

### Incident Patch 12: `4f036575` (2025-02-14)
**Commit Message**: Fix Build Workflow (#1591)

**File**: `.github/workflows/publish-docker-images.yml` (modified, +0/-47)
```diff
@@ -103,53 +103,6 @@ jobs:
           cache-from: type=gha
           cache-to: type=gha,mode=max
 
-  backup:
-    name: Build Backup Image
-    environment: Deployment
-    defaults:
-      run:
-        working-directory: ./
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v2
-
-      - name: Set production tag
-        run: ./.github/helpers/set_release_type.sh ${{ inputs.type }} $GITHUB_ENV ${{ inputs.version }}
-
-      - name: Set up Docker Buildx
-        uses: docker/setup-buildx-action@v2
-        with:
-          cache-from: type=gha
-          cache-to: type=gha,mode=max
-
-      - name: Login to DockerHub
-        uses: docker/login-action@v2
-        with:
-          username: ${{ secrets.DOCKERHUB_USERNAME }}
-          password: ${{ secrets.DOCKERHUB_TOKEN }}
-
-      - name: Build and export pre-release
-        if: ${{ inputs.type == 'pre-release' }}
-        uses: docker/build-push-action@v3
-        with:
-          context: .
-          file: ./backup/Dockerfile
-          tags: featureformcom/backup:${{ env.TAG }}
-          push: true
-          cache-from: type=gha
-          cache-to: type=gha,mode=max
-
-      - name: Build and export release
-        if: ${{ inputs.type == 'release' }}
-        uses: docker/build-push-action@v3
-        with:
-          context: .
-          file: ./backup/Dockerfile
-          tags: featureformcom/backup:${{ env.TAG }},featureformcom/backup:latest
-          push: true
-          cache-from: type=gha
-          cache-to: type=gha,mode=max
-
   coordinator:
     name: Build Coordinator
     environment: Deployment
```

**File**: `api/Dockerfile` (modified, +1/-4)
```diff
@@ -20,12 +20,9 @@ COPY ./storage ./storage
 COPY ./schema ./schema
 COPY ./lib/ ./lib/
 COPY ./filestore/ ./filestore/
-COPY ./metadata/*.go ./metadata/
+COPY ./metadata/ ./metadata/
 COPY ./integrations/ ./integrations/
 COPY ./lib/ ./lib/
-COPY ./metadata/search/ ./metadata/search/
-COPY ./metadata/proto/ ./metadata/proto/
-COPY ./metadata/equivalence/ ./metadata/equivalence/
 COPY ./proto/ ./proto/
 COPY ./helpers/ ./helpers/
 COPY ./logging/ ./logging/
```

**File**: `metadata/Dockerfile` (modified, +2/-6)
```diff
@@ -31,18 +31,14 @@ COPY ./schema ./schema
 COPY ./lib/ ./lib/
 COPY ./filestore/ ./filestore/
 COPY ./logging/ ./logging/
-COPY ./metadata/*.go ./metadata/
-COPY ./metadata/proto/ ./metadata/proto/
+COPY ./metadata/ ./metadata/
 COPY ./db ./db
 COPY ./helpers/ ./helpers/
 COPY ./integrations/ ./integrations/
-COPY ./metadata/search/ ./metadata/search/
-COPY ./metadata/equivalence/ ./metadata/equivalence/
-COPY ./metadata/server/server.go ./metadata/main/server.go
 COPY ./provider/ ./provider
 COPY ./config/ ./config/
 
-RUN go build ./metadata/main/server.go
+RUN go build ./metadata/server/server.go
 
 FROM alpine
 
```

---

### Incident Patch 13: `135c1590` (2025-02-14)
**Commit Message**: Removes all WARN and ERROR logs in typical quickstart flow (#1592)

**File**: `api/api.go` (modified, +82/-67)
```diff
@@ -133,10 +133,16 @@ func (serv *MetadataServer) MarkForDeletion(ctx context.Context, req *pb.MarkFor
 func (serv *MetadataServer) GetUsers(stream pb.Api_GetUsersServer) error {
 	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
 	logger.Infow("Getting Users")
+	proxyStream, err := serv.meta.GetUsers(ctx)
+	if err != nil {
+		logger.Errorw("Failed to get users from server", "error", err)
+		return err
+	}
 	for {
 		nameRequest, err := stream.Recv()
 		if err == io.EOF {
 			logger.Debugw("End of stream reached. Stream request completed")
+			proxyStream.CloseSend()
 			return nil
 		}
 		if err != nil {
@@ -147,11 +153,6 @@ func (serv *MetadataServer) GetUsers(stream pb.Api_GetUsersServer) error {
 		loggerWithResource.Infow("Getting user from stream")
 		nameRequest.RequestId = requestID.String()
 
-		proxyStream, err := serv.meta.GetUsers(ctx)
-		if err != nil {
-			loggerWithResource.Errorw("Failed to get users from server", "error", err)
-			return err
-		}
 		sErr := proxyStream.Send(nameRequest)
 		if sErr != nil {
 			loggerWithResource.Errorw("Failed to send user to the server", "error", sErr)
@@ -175,10 +176,16 @@ func (serv *MetadataServer) GetUsers(stream pb.Api_GetUsersServer) error {
 func (serv *MetadataServer) GetFeatures(stream pb.Api_GetFeaturesServer) error {
 	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
 	logger.Infow("Getting Features")
+	proxyStream, err := serv.meta.GetFeatures(ctx)
+	if err != nil {
+		logger.Errorw("Failed to get features from server", "error", err)
+		return err
+	}
 	for {
 		nameRequest, err := stream.Recv()
 		if err == io.EOF {
 			logger.Debugw("End of stream reached. Stream request completed")
+			proxyStream.CloseSend()
 			return nil
 		}
 		if err != nil {
@@ -188,11 +195,6 @@ func (serv *MetadataServer) GetFeatures(stream pb.Api_GetFeaturesServer) error {
 		loggerWithResource := logger.WithResource(logging.Feature, nameRequest.Name.Name, logging.NoVariant)
 		loggerWithResource.Infow("Getting feature from stream")
 		nameRequest.RequestId = requestID.String()
-		proxyStream, err := serv.meta.GetFeatures(ctx)
-		if err != nil {
-			loggerWithResource.Errorw("Failed to get features from server", "error", err)
-			return err
-		}
 		sErr := proxyStream.Send(nameRequest)
 		if sErr != nil {
 			loggerWithResource.Errorw("Failed to send feature to the server", "error", sErr)
@@ -216,10 +218,16 @@ func (serv *MetadataServer) GetFeatures(stream pb.Api_GetFeaturesServer) error {
 func (serv *MetadataServer) GetFeatureVariants(stream pb.Api_GetFeatureVariantsServer) error {
 	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
 	logger.Infow("Getting Feature Variants")
+	proxyStream, err := serv.meta.GetFeatureVariants(ctx)
+	if err != nil {
+		logger.Errorw("Failed to get feature variants from server", "error", err)
+		return err
+	}
 	for {
 		nameVariantRequest, err := stream.Recv()
 		if err == io.EOF {
 			logger.Debugw("End of stream reached. Stream request completed")
+			proxyStream.CloseSend()
 			return nil
 		}
 		if err != nil {
@@ -230,11 +238,6 @@ func (serv *MetadataServer) GetFeatureVariants(stream pb.Api_GetFeatureVariantsS
 		loggerWithResource.Infow("Getting feature variant from stream")
 		nameVariantRequest.RequestId = requestID.String()
 
-		proxyStream, err := serv.meta.GetFeatureVariants(ctx)
-		if err != nil {
-			loggerWithResource.Errorw("Failed to get feature variants from server", "error", err)
-			return err
-		}
 		sErr := proxyStream.Send(nameVariantRequest)
 		if sErr != nil {
 			loggerWithResource.Errorw("Failed to send feature variant to the server", "error", sErr)
@@ -256,10 +259,16 @@ func (serv *MetadataServer) GetFeatureVariants(stream pb.Api_GetFeatureVariantsS
 func (serv *MetadataServer) GetLabels(stream pb.Api_GetLabelsServer) error {
 	requestID, ctx, logger := serv.Logger.InitializeRequestID(stream.Context())
 	logger.Infow("Getting Labels")
+	proxyStream, err := serv.meta.GetLabels(ctx)
+	if err != nil {
+		logger.Errorw("Failed to get labels from server", "error", err)
+		return err
+	}
 	for {
 		nameRequest, err := stream.Recv()
 		if err == io.EOF {
 			logger.Debugw("End of stream reached. Stream request completed")
+			proxyStream.CloseSend()
 			return nil
 		}
 		if err != nil {
@@ -269,11 +278,6 @@ func (serv *MetadataServer) GetLabels(stream pb.Api_GetLabelsServer) error {
 		loggerWithResource := logger.WithResource(logging.Label, nameRequest.Name.Name, logging.NoVariant)
 		loggerWithResource.Infow("Getting label from stream")
 		nameRequest.RequestId = requestID.String()
-		proxyStream, err := serv.meta.GetLabels(ctx)
-		if err != nil {
-			loggerWithResource.Errorw("Failed to get labels from server", "error", err)
-			return err
-		}
 		sErr := proxyStream.Send(nameRequest)
 		if sErr != nil {
 			loggerWithResource.Errorw("Failed to send labels to the server", "error", sErr)
@@ -297,10 +301,16 @@ func (serv *MetadataSer
```

**File**: `coordinator/tasks/feature.go` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ func (t *FeatureTask) Run() error {
 	}
 
 	sourceNameVariant := feature.Source()
-	source, err := t.awaitPendingSource(sourceNameVariant)
+	source, err := t.awaitPendingSource(ctx, sourceNameVariant)
 	if err != nil {
 		return err
 	}
```

**File**: `coordinator/tasks/label.go` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ func (t *LabelTask) Run() error {
 		return err
 	}
 
-	source, err := t.awaitPendingSource(sourceNameVariant)
+	source, err := t.awaitPendingSource(ctx, sourceNameVariant)
 	if err != nil {
 		logger.Errorw("Failed to await pending source", "error", err)
 		return err
```

**File**: `coordinator/tasks/tasks.go` (modified, +3/-3)
```diff
@@ -129,10 +129,10 @@ func (bt *BaseTask) waitForRunCompletion(id []scheduling.TaskRunID) error {
 	return nil
 }
 
-func (t *BaseTask) awaitPendingSource(sourceNameVariant metadata.NameVariant) (*metadata.SourceVariant, error) {
+func (t *BaseTask) awaitPendingSource(ctx context.Context, sourceNameVariant metadata.NameVariant) (*metadata.SourceVariant, error) {
 	sourceStatus := scheduling.PENDING
 	for sourceStatus != scheduling.READY {
-		source, err := t.metadata.GetSourceVariant(context.Background(), sourceNameVariant)
+		source, err := t.metadata.GetSourceVariant(ctx, sourceNameVariant)
 		if err != nil {
 			return nil, err
 		}
@@ -152,5 +152,5 @@ func (t *BaseTask) awaitPendingSource(sourceNameVariant metadata.NameVariant) (*
 		}
 		time.Sleep(t.config.DependencyPollInterval)
 	}
-	return t.metadata.GetSourceVariant(context.Background(), sourceNameVariant)
+	return t.metadata.GetSourceVariant(ctx, sourceNameVariant)
 }
```

**File**: `coordinator/tasks/trainingset.go` (modified, +9/-9)
```diff
@@ -31,8 +31,8 @@ type TrainingSetTask struct {
 }
 
 func (t *TrainingSetTask) Run() error {
-	logger := t.logger.With("%#v\n", t.taskDef.Target)
-	ctx := logger.AttachToContext(context.Background())
+	_, ctx, logger := t.logger.InitializeRequestID(context.TODO())
+	logger = logger.With("%#v\n", t.taskDef.Target)
 	nv, ok := t.taskDef.Target.(scheduling.NameVariant)
 	if !ok {
 		logger.Errorw("cannot create a training set from target type", "type", t.taskDef.TargetType)
@@ -99,7 +99,7 @@ func (t *TrainingSetTask) Run() error {
 			return err
 		}
 		sourceNameVariant := featureResource.Source()
-		sourceVariant, err := t.awaitPendingSource(sourceNameVariant)
+		sourceVariant, err := t.awaitPendingSource(ctx, sourceNameVariant)
 		if err != nil {
 			logger.Errorw("Failed to wait on pending feature source", "error", err)
 			return err
@@ -133,7 +133,7 @@ func (t *TrainingSetTask) Run() error {
 		return err
 	}
 	labelSourceNameVariant := label.Source()
-	_, err = t.awaitPendingSource(labelSourceNameVariant)
+	_, err = t.awaitPendingSource(ctx, labelSourceNameVariant)
 	if err != nil {
 		logger.Errorw("Failed to wait on pending label source", "error", err)
 		return err
@@ -349,7 +349,7 @@ func (t *TrainingSetTask) getFeatureSourceMapping(ctx context.Context, feature *
 		return provider.SourceMapping{}, err
 	}
 	logger.Debugw("Feature Source Provider", "type", sourceProvider.Type())
-	featureSource, err := t.getFeatureSourceTableName(sourceProvider, feature)
+	featureSource, err := t.getFeatureSourceTableName(ctx, sourceProvider, feature)
 	if err != nil {
 		return provider.SourceMapping{}, err
 	}
@@ -450,11 +450,11 @@ func (t *TrainingSetTask) getResourceLocation(provider *metadata.Provider, table
 	return location, err
 }
 
-func (t *TrainingSetTask) getFeatureSourceTableName(p *metadata.Provider, feature *metadata.FeatureVariant) (string, error) {
+func (t *TrainingSetTask) getFeatureSourceTableName(ctx context.Context, p *metadata.Provider, feature *metadata.FeatureVariant) (string, error) {
 	var resourceType provider.OfflineResourceType
 	switch pt.Type(p.Type()) {
 	case pt.SnowflakeOffline, pt.BigQueryOffline, pt.PostgresOffline:
-		return t.getSourceTableNameForNonMaterializedProviders(feature)
+		return t.getSourceTableNameForNonMaterializedProviders(ctx, feature)
 	case pt.MemoryOffline, pt.MySqlOffline, pt.ClickHouseOffline, pt.RedshiftOffline, pt.SparkOffline, pt.K8sOffline:
 		resourceType = provider.Feature
 	default:
@@ -471,9 +471,9 @@ func (t *TrainingSetTask) getFeatureSourceTableName(p *metadata.Provider, featur
 // we need all rows for a given entity to correctly create a training set. Therefore, we now use the source variant
 // as the source of a feature and allow the training set query to determine how to handle the source data based on
 // the presence/absence of timestamps in both the features and label.
-func (t *TrainingSetTask) getSourceTableNameForNonMaterializedProviders(feature *metadata.FeatureVariant) (string, error) {
+func (t *TrainingSetTask) getSourceTableNameForNonMaterializedProviders(ctx context.Context, feature *metadata.FeatureVariant) (string, error) {
 	sourceNv := feature.Source()
-	sv, err := t.metadata.GetSourceVariant(context.TODO(), sourceNv)
+	sv, err := t.metadata.GetSourceVariant(ctx, sourceNv)
 	if err != nil {
 		t.logger.Errorw("could not get source variant", "name_variant", sourceNv, "err", err)
 		return "", err
```

**File**: `health/health.go` (modified, +2/-2)
```diff
@@ -26,8 +26,8 @@ func NewHealth(client *metadata.Client) *Health {
 	}
 }
 
-func (h *Health) CheckProvider(name string) (bool, error) {
-	rec, err := h.metadata.GetProvider(context.Background(), name)
+func (h *Health) CheckProvider(ctx context.Context, name string) (bool, error) {
+	rec, err := h.metadata.GetProvider(ctx, name)
 	if err != nil {
 		return false, err
 	}
```

**File**: `health/health_test.go` (modified, +6/-4)
```diff
@@ -400,11 +400,12 @@ func initProvider(t *testing.T, providerType pt.Type, executorType pc.SparkExecu
 }
 
 func testSuccessfulHealthCheck(t *testing.T, client *metadata.Client, health *Health, def metadata.ProviderDef) {
-	if err := client.Create(context.Background(), def); err != nil {
+	ctx := logging.NewTestContext(t)
+	if err := client.Create(ctx, def); err != nil {
 		t.Fatalf("Failed to create provider: %s", err)
 	}
 	t.Run(string(def.Name), func(t *testing.T) {
-		isHealthy, err := health.CheckProvider(def.Name)
+		isHealthy, err := health.CheckProvider(ctx, def.Name)
 		if err != nil {
 			t.Fatalf("Failed to check provider health: %s", err)
 		}
@@ -516,11 +517,12 @@ func testUnsuccessfulHealthCheck(t *testing.T, client *metadata.Client, health *
 	default:
 		t.Skip("Skipping unsupported provider type")
 	}
-	if err := client.Create(context.Background(), def); err != nil {
+	ctx := logging.NewTestContext(t)
+	if err := client.Create(ctx, def); err != nil {
 		t.Fatalf("Failed to create provider: %s", err)
 	}
 	t.Run(string(def.Name), func(t *testing.T) {
-		isHealthy, err := health.CheckProvider(def.Name)
+		isHealthy, err := health.CheckProvider(ctx, def.Name)
 		if err == nil {
 			t.Fatalf("(%s) Expected error but received none", def.Type)
 		}
```

**File**: `logging/logging.go` (modified, +1/-1)
```diff
@@ -195,7 +195,7 @@ func (logger Logger) WithProvider(providerType, providerName string) Logger {
 	if providerType != "" {
 		newValues["provider-type"] = providerType
 		logger.SugaredLogger = logger.SugaredLogger.With("provider-type", providerType)
-	} else {
+	} else if providerType != SkipProviderType {
 		logger.Warn("Provider type is empty")
 	}
 
```

---

### Incident Patch 14: `051dfc28` (2025-02-13)
**Commit Message**: Bugfix: Handle nil when casting tabletype (#1590)

**File**: `provider/sql.go` (modified, +9/-2)
```diff
@@ -20,6 +20,9 @@ import (
 
 	sf "github.com/snowflakedb/gosnowflake"
 
+	"github.com/google/uuid"
+	db "github.com/jackc/pgx/v4"
+
 	"github.com/featureform/fferr"
 	"github.com/featureform/logging"
 	"github.com/featureform/metadata"
@@ -28,8 +31,6 @@ import (
 	ps "github.com/featureform/provider/provider_schema"
 	pt "github.com/featureform/provider/provider_type"
 	"github.com/featureform/provider/types"
-	"github.com/google/uuid"
-	db "github.com/jackc/pgx/v4"
 )
 
 func sanitize(ident string) string {
@@ -1936,6 +1937,12 @@ func (q defaultOfflineSQLQueries) trainingSetUpdate(store *sqlOfflineStore, def
 }
 
 func (q defaultOfflineSQLQueries) castTableItemType(v interface{}, t interface{}) interface{} {
+	logger := logging.GlobalLogger.With("function", "castTableItemType")
+	if v == nil {
+		logger.Debugw("Value is nil")
+		return nil
+	}
+
 	switch t {
 	case sfInt, sfNumber:
 		if intVar, err := strconv.Atoi(v.(string)); err != nil {
```

---

### Incident Patch 15: `0d065dad` (2025-02-12)
**Commit Message**: Kamal/fix label resource schema (#1589)

**File**: `coordinator/tasks/trainingset.go` (modified, +22/-10)
```diff
@@ -231,8 +231,8 @@ func (t *TrainingSetTask) getLabelSourceMapping(ctx context.Context, label *meta
 	}
 	logger.Debugw("Label Provider", "type", labelProvider.Type())
 	switch pt.Type(labelProvider.Type()) {
-	case pt.SnowflakeOffline:
-		logger.Debugw("Getting label source mapping from resource table ...")
+	case pt.SnowflakeOffline, pt.BigQueryOffline, pt.PostgresOffline:
+		logger.Debugw("Getting label source mapping from source ...")
 		return t.getLabelSourceMappingFromSource(label, labelProvider, ctx)
 	default:
 		logger.Debugw("Getting label source mapping from resource table ...")
@@ -332,8 +332,7 @@ func (t *TrainingSetTask) getLabelSourceMappingFromSource(label *metadata.LabelV
 		logger.Errorw("could not get label location", "label", label.Name(), "variant", label.Variant(), "error", err)
 		return provider.SourceMapping{}, err
 	}
-	logger.Debugw("Label entity mappings", "mappings", lblEntityMappings)
-	logger.Debugw("Successfully got label source mapping from source")
+	logger.Debugw("Successfully got label source mapping from source", "entity_mappings", lblEntityMappings, "loc", location)
 	return provider.SourceMapping{
 		ProviderType:   pt.Type(labelProvider.Type()),
 		ProviderConfig: labelProvider.SerializedConfig(),
@@ -423,6 +422,7 @@ func (t *TrainingSetTask) AwaitPendingLabel(ctx context.Context, labelNameVarian
 func (t *TrainingSetTask) getResourceLocation(provider *metadata.Provider, tableName string) (pl.Location, error) {
 	var location pl.Location
 	var err error
+	// TODO: Handle this in a generic way.
 	switch pt.Type(provider.Type()) {
 	case pt.SnowflakeOffline:
 		config := pc.SnowflakeConfig{}
@@ -432,18 +432,30 @@ func (t *TrainingSetTask) getResourceLocation(provider *metadata.Provider, table
 		// TODO: (Erik) determine if we want to use the Catalog location instead of SQL location; technically,
 		// Snowflake references tables in a catalog no differently than it does other table types.
 		location = pl.NewFullyQualifiedSQLLocation(config.Database, config.Schema, tableName)
+	case pt.BigQueryOffline:
+		config := pc.BigQueryConfig{}
+		if err := config.Deserialize(provider.SerializedConfig()); err != nil {
+			return nil, err
+		}
+		location = pl.NewFullyQualifiedSQLLocation(config.ProjectId, config.DatasetId, tableName)
+	case pt.PostgresOffline:
+		config := pc.PostgresConfig{}
+		if err := config.Deserialize(provider.SerializedConfig()); err != nil {
+			return nil, err
+		}
+		location = pl.NewFullyQualifiedSQLLocation(config.Database, config.Schema, tableName)
 	default:
-		t.logger.Errorw("unsupported provider type: %s", provider.Type())
+		t.logger.Errorf("unsupported provider type: %s", provider.Type())
 	}
 	return location, err
 }
 
 func (t *TrainingSetTask) getFeatureSourceTableName(p *metadata.Provider, feature *metadata.FeatureVariant) (string, error) {
 	var resourceType provider.OfflineResourceType
 	switch pt.Type(p.Type()) {
-	case pt.SnowflakeOffline:
-		return t.getSourceTableNameForSnowflake(feature)
-	case pt.MemoryOffline, pt.MySqlOffline, pt.PostgresOffline, pt.ClickHouseOffline, pt.RedshiftOffline, pt.SparkOffline, pt.BigQueryOffline, pt.K8sOffline:
+	case pt.SnowflakeOffline, pt.BigQueryOffline, pt.PostgresOffline:
+		return t.getSourceTableNameForNonMaterializedProviders(feature)
+	case pt.MemoryOffline, pt.MySqlOffline, pt.ClickHouseOffline, pt.RedshiftOffline, pt.SparkOffline, pt.K8sOffline:
 		resourceType = provider.Feature
 	default:
 		t.logger.Errorw("unsupported provider type", "type", p.Type())
@@ -453,13 +465,13 @@ func (t *TrainingSetTask) getFeatureSourceTableName(p *metadata.Provider, featur
 	return ps.ResourceToTableName(resourceType.String(), feature.Name(), feature.Variant())
 }
 
-// getSourceTableNameForSnowflake returns the fully qualified table name for a feature's source variant.
+// getSourceTableNameForNonMaterializedProviders returns the fully qualified table name for a feature's source variant.
 // **NOTE:** In the past, we used the feature materialization as the source of a feature for a training set;
 // however, this was incorrect because that data set will only ever have one row per entity, and in many cases,
 // we need all rows for a given entity to correctly create a training set. Therefore, we now use the source variant
 // as the source of a feature and allow the training set query to determine how to handle the source data based on
 // the presence/absence of timestamps in both the features and label.
-func (t *TrainingSetTask) getSourceTableNameForSnowflake(feature *metadata.FeatureVariant) (string, error) {
+func (t *TrainingSetTask) getSourceTableNameForNonMaterializedProviders(feature *metadata.FeatureVariant) (string, error) {
 	sourceNv := feature.Source()
 	sv, err := t.metadata.GetSourceVariant(context.TODO(), sourceNv)
 	if err != nil {
```

**File**: `helpers/postgres/postgres.go` (renamed, +11/-0)
```diff
@@ -19,6 +19,7 @@ import (
 	"github.com/featureform/fferr"
 	"github.com/featureform/logging"
 	"github.com/featureform/logging/redacted"
+	pl "github.com/featureform/provider/location"
 
 	"github.com/avast/retry-go/v4"
 	psql "github.com/jackc/pgx/v4"
@@ -183,3 +184,13 @@ func (c Config) ConnectionString() string {
 func Sanitize(ident string) string {
 	return psql.Identifier{ident}.Sanitize()
 }
+
+func SanitizeLocation(obj pl.SQLLocation) string {
+	var parts []string
+	if obj.GetDatabase() != "" && obj.GetSchema() != "" {
+		parts = append(parts, obj.GetDatabase())
+		parts = append(parts, obj.GetSchema())
+	}
+	parts = append(parts, obj.GetTable())
+	return psql.Identifier(parts).Sanitize()
+}
```

**File**: `provider/bigquery.go` (modified, +4/-5)
```diff
@@ -258,8 +258,8 @@ func (store *bqOfflineStore) newBigQueryPrimaryTable(name string) (*bqPrimaryTab
 	}, nil
 }
 
-func (q defaultBQQueries) registerResources(client *bigquery.Client, tableName string, schema ResourceSchema, timestamp bool) error {
-	logger := q.logger.With("table", tableName, "schema", schema, "timestamp", timestamp)
+func (q defaultBQQueries) registerResources(client *bigquery.Client, tableName string, schema ResourceSchema) error {
+	logger := q.logger.With("table", tableName, "schema", schema)
 
 	var sourceLocation, isSqlLocation = schema.SourceTable.(*pl.SQLLocation)
 	if !isSqlLocation {
@@ -275,7 +275,7 @@ func (q defaultBQQueries) registerResources(client *bigquery.Client, tableName s
 	}
 	sb.WriteString(fmt.Sprintf("`%s` AS value, ", schema.EntityMappings.ValueColumn))
 
-	if timestamp {
+	if schema.TS != "" {
 		sb.WriteString(fmt.Sprintf("`%s` as ts ",
 			schema.TS,
 		))
@@ -945,8 +945,7 @@ func (store *bqOfflineStore) RegisterResourceFromSourceTable(id ResourceID, sche
 		return nil, err
 	}
 
-	useTimestamp := schema.TS != ""
-	if err := store.query.registerResources(store.client, tableName, schema, useTimestamp); err != nil {
+	if err := store.query.registerResources(store.client, tableName, schema); err != nil {
 		logger.Error("Error registering resources", "error", err)
 		return nil, err
 	}
```

**File**: `provider/clickhouse.go` (modified, +10/-14)
```diff
@@ -595,14 +595,8 @@ func (store *clickHouseOfflineStore) RegisterResourceFromSourceTable(id Resource
 	if err != nil {
 		return nil, err
 	}
-	if schema.TS == "" {
-		if err := store.query.registerResources(store.db, tableName, schema, false); err != nil {
-			return nil, err
-		}
-	} else {
-		if err := store.query.registerResources(store.db, tableName, schema, true); err != nil {
-			return nil, err
-		}
+
+	if err := store.query.registerResources(store.db, tableName, schema); err != nil {
 	}
 
 	return &clickhouseOfflineTable{
@@ -900,7 +894,9 @@ func (store *clickHouseOfflineStore) CreateMaterialization(id ResourceID, opts M
 	if err != nil {
 		return nil, err
 	}
-	materializeQueries := store.query.materializationCreate(matTableName, resTable.name)
+	// TODO: Fix when we get to refactoring clickhouse
+	opts.Schema.SourceTable = pl.NewSQLLocation(resTable.name)
+	materializeQueries := store.query.materializationCreate(matTableName, opts.Schema)
 	for _, materializeQry := range materializeQueries {
 		_, err = store.db.Exec(materializeQry)
 		if err != nil {
@@ -1239,9 +1235,9 @@ func (q clickhouseSQLQueries) trainingRowSplitSelect(columns string, trainingSet
 	return trainSplitQuery, testSplitQuery
 }
 
-func (q clickhouseSQLQueries) registerResources(db *sql.DB, tableName string, schema ResourceSchema, timestamp bool) error {
+func (q clickhouseSQLQueries) registerResources(db *sql.DB, tableName string, schema ResourceSchema) error {
 	var query string
-	if timestamp {
+	if schema.TS != "" {
 		query = fmt.Sprintf("CREATE VIEW %s AS SELECT %s as entity, %s as value, %s as ts FROM %s", SanitizeClickHouseIdentifier(tableName),
 			SanitizeClickHouseIdentifier(schema.Entity), SanitizeClickHouseIdentifier(schema.Value), SanitizeClickHouseIdentifier(schema.TS), SanitizeClickHouseIdentifier(schema.SourceTable.Location()))
 	} else {
@@ -1261,10 +1257,10 @@ func (q clickhouseSQLQueries) primaryTableRegister(tableName string, sourceName
 	return fmt.Sprintf("CREATE VIEW %s AS SELECT * FROM %s", SanitizeClickHouseIdentifier(tableName), sourceName)
 }
 
-func (q clickhouseSQLQueries) materializationCreate(tableName string, sourceName string) []string {
-	return []string{fmt.Sprintf("CREATE TABLE %s ENGINE = MergeTree ORDER BY (entity, ts) SETTINGS allow_nullable_key=1 EMPTY AS SELECT * FROM %s", SanitizeClickHouseIdentifier(tableName), SanitizeClickHouseIdentifier(sourceName)),
+func (q clickhouseSQLQueries) materializationCreate(tableName string, schema ResourceSchema) []string {
+	return []string{fmt.Sprintf("CREATE TABLE %s ENGINE = MergeTree ORDER BY (entity, ts) SETTINGS allow_nullable_key=1 EMPTY AS SELECT * FROM %s", SanitizeClickHouseIdentifier(tableName), SanitizeClickHouseIdentifier(schema.SourceTable.Location())),
 		fmt.Sprintf("ALTER TABLE %s ADD COLUMN row_number UInt64;", SanitizeClickHouseIdentifier(tableName)),
-		fmt.Sprintf("INSERT INTO %s SELECT entity, value, tis AS ts, row_number() OVER () AS row_number FROM (SELECT entity, max(ts) AS tis, argMax(value, ts) AS value FROM %s GROUP BY entity ORDER BY entity ASC, value ASC);", SanitizeClickHouseIdentifier(tableName), SanitizeClickHouseIdentifier(sourceName)),
+		fmt.Sprintf("INSERT INTO %s SELECT entity, value, tis AS ts, row_number() OVER () AS row_number FROM (SELECT entity, max(ts) AS tis, argMax(value, ts) AS value FROM %s GROUP BY entity ORDER BY entity ASC, value ASC);", SanitizeClickHouseIdentifier(tableName), SanitizeClickHouseIdentifier(schema.SourceTable.Location())),
 	}
 }
 
```

**File**: `provider/correctness_test.go` (modified, +11/-6)
```diff
@@ -38,6 +38,7 @@ func TestTransformations(t *testing.T) {
 	}{
 		{getConfiguredBigQueryTester(t, false)},
 		{getConfiguredSnowflakeTester(t, true)},
+		{getConfiguredPostgresTester(t, false)},
 	}
 
 	testSuite := map[string]func(t *testing.T, storeTester offlineSqlTest){
@@ -67,6 +68,7 @@ func TestMaterializations(t *testing.T) {
 	}{
 		{getConfiguredBigQueryTester(t, false)},
 		{getConfiguredSnowflakeTester(t, true)},
+		{getConfiguredPostgresTester(t, false)},
 	}
 
 	testSuite := map[string]func(t *testing.T, storeTester offlineSqlTest){
@@ -100,6 +102,9 @@ func TestTrainingSets(t *testing.T) {
 		{
 			getConfiguredSnowflakeTester(t, true),
 		},
+		{
+			getConfiguredPostgresTester(t, true),
+		},
 	}
 
 	testSuite := []trainingSetDatasetType{
@@ -121,8 +126,8 @@ func TestTrainingSets(t *testing.T) {
 	}
 }
 
-func newSQLTransformationTest(tester offlineSqlStoreTester, transformationQuery string) *sqlTransformationTester {
-	data := newTestSQLTransformationData(tester, transformationQuery)
+func newSQLTransformationTest(tester offlineSqlStoreTester, transformationQuery string, sanitizeTableNameFn func(object pl.FullyQualifiedObject) string) *sqlTransformationTester {
+	data := newTestSQLTransformationData(tester, transformationQuery, sanitizeTableNameFn)
 	return &sqlTransformationTester{
 		tester: tester,
 		data:   data,
@@ -226,7 +231,7 @@ func (a idCreator) create(t OfflineResourceType, name string) ResourceID {
 	}
 }
 
-func newTestSQLTransformationData(tester offlineSqlStoreTester, transformationQuery string) testSQLTransformationData {
+func newTestSQLTransformationData(tester offlineSqlStoreTester, transformationQuery string, sanitizeTableNameFn func(object pl.FullyQualifiedObject) string) testSQLTransformationData {
 	db := tester.GetTestDatabase()
 	schema := fmt.Sprintf("SCHEMA_%s", strings.ToUpper(uuid.NewString()[:5]))
 	loc := pl.NewFullyQualifiedSQLLocation(db, schema, "TEST_WIND_DATA_TABLE")
@@ -323,7 +328,7 @@ func newTestSQLTransformationData(tester offlineSqlStoreTester, transformationQu
 		config: TransformationConfig{
 			Type:          SQLTransformation,
 			TargetTableID: idCreator.create(Transformation, ""),
-			Query:         fmt.Sprintf(queryFmt, tableLoc.String()),
+			Query:         fmt.Sprintf(queryFmt, sanitizeTableNameFn(tableLoc)),
 			SourceMapping: []SourceMapping{
 				{
 					Template:       SanitizeSqlLocation(tableLoc),
@@ -1096,7 +1101,7 @@ func getTrainingSetDatasetNoTS(tester offlineSqlStoreTester, storeType pt.Type,
 }
 
 func RegisterTransformationOnPrimaryDatasetTest(t *testing.T, tester offlineSqlTest) {
-	test := newSQLTransformationTest(tester.storeTester, tester.transformationQuery)
+	test := newSQLTransformationTest(tester.storeTester, tester.transformationQuery, tester.sanitizeTableName)
 	_ = initSqlPrimaryDataset(t, test.tester, test.data.location, test.data.schema, test.data.records)
 	if err := test.tester.CreateTransformation(test.data.config); err != nil {
 		t.Fatalf("could not create transformation: %v", err)
@@ -1109,7 +1114,7 @@ func RegisterTransformationOnPrimaryDatasetTest(t *testing.T, tester offlineSqlT
 }
 
 func RegisterChainedTransformationsTest(t *testing.T, tester offlineSqlTest) {
-	test := newSQLTransformationTest(tester.storeTester, tester.transformationQuery)
+	test := newSQLTransformationTest(tester.storeTester, tester.transformationQuery, tester.sanitizeTableName)
 	_ = initSqlPrimaryDataset(t, test.tester, test.data.location, test.data.schema, test.data.records)
 	if err := test.tester.CreateTransformation(test.data.config); err != nil {
 		t.Fatalf("could not create transformation: %v", err)
```

**File**: `provider/mysql.go` (modified, +4/-4)
```diff
@@ -77,10 +77,10 @@ func (q mySQLQueries) viewExists() string {
 	return "SELECT COUNT(*) FROM information_schema.views WHERE table_name = ? AND table_schema = CURRENT_SCHEMA()"
 }
 
-func (q mySQLQueries) registerResources(db *sql.DB, tableName string, schema ResourceSchema, timestamp bool) error {
+func (q mySQLQueries) registerResources(db *sql.DB, tableName string, schema ResourceSchema) error {
 	var query *sql.Stmt
 	var err error
-	if !timestamp {
+	if schema.TS == "" {
 		schema.TS = time.Now().UTC().Format("2006-01-02 15:04:05")
 	}
 	query, err = db.Prepare("CREATE VIEW ? AS SELECT ? as entity, ? as value, ? as ts FROM ?")
@@ -103,8 +103,8 @@ func (q mySQLQueries) primaryTableRegister(tableName string, sourceName string)
 
 // materializationCreate satisfies the OfflineTableQueries interface.
 // mySQL doesn't have materialized views.
-func (q mySQLQueries) materializationCreate(tableName string, sourceName string) []string {
-	return []string{q.primaryTableRegister(tableName, sourceName)}
+func (q mySQLQueries) materializationCreate(tableName string, schema ResourceSchema) []string {
+	return []string{q.primaryTableRegister(tableName, schema.SourceTable.Location())}
 }
 
 func (q mySQLQueries) materializationUpdate(db *sql.DB, tableName string, sourceName string) error {
```

**File**: `provider/offline_test.go` (modified, +2/-1)
```diff
@@ -67,7 +67,8 @@ func (test *OfflineStoreTest) Run() {
 		"LabelTableNotFound":     testLabelTableNotFound,
 		"FeatureTableNotFound":   testFeatureTableNotFound,
 		"TrainingDefShorthand":   testTrainingSetDefShorthand,
-		"ResourceLocation":       testResourceLocation,
+		// TODO: Re-enable when refactoring providers
+		//"ResourceLocation":       testResourceLocation,
 	}
 
 	for name, fn := range testFns {
```

**File**: `provider/postgres.go` (modified, +112/-60)
```diff
@@ -11,11 +11,16 @@ import (
 	"database/sql"
 	"fmt"
 	"strings"
+	"text/template"
 	"time"
 
 	"github.com/featureform/fferr"
+	helper "github.com/featureform/helpers/postgres"
+	"github.com/featureform/logging"
+	pl "github.com/featureform/provider/location"
 	pc "github.com/featureform/provider/provider_config"
 	pt "github.com/featureform/provider/provider_type"
+	tsq "github.com/featureform/provider/tsquery"
 	"github.com/featureform/provider/types"
 	_ "github.com/lib/pq"
 )
@@ -63,6 +68,18 @@ func postgresOfflineStoreFactory(config pc.SerializedConfig) (Provider, error) {
 	if err != nil {
 		return nil, err
 	}
+
+	// We override the default getDb method, as when the db or schema
+	// is empty, we use the default one configured.
+	prevGetDb := store.getDb
+	store.getDb = func(database, schema string) (*sql.DB, error) {
+		if database == "" || schema == "" {
+			return prevGetDb(sc.Database, sc.Schema)
+		} else {
+			return prevGetDb(database, schema)
+		}
+	}
+
 	return store, nil
 }
 
@@ -75,37 +92,71 @@ func (q postgresSQLQueries) tableExists() string {
 }
 
 func (q postgresSQLQueries) viewExists() string {
-	return "select count(*) from pg_views where viewname = $1 AND schemaname = CURRENT_SCHEMA()"
+	return "select " +
+		"(select count(*) from pg_matviews where matviewname = $1 AND schemaname = CURRENT_SCHEMA())" +
+		"+ (select count(*) from pg_views where viewname = $1 AND schemaname = CURRENT_SCHEMA())"
 }
 
-func (q postgresSQLQueries) registerResources(db *sql.DB, tableName string, schema ResourceSchema, timestamp bool) error {
-	var query string
-	if timestamp {
-		query = fmt.Sprintf("CREATE VIEW %s AS SELECT %s as entity, %s as value, %s as ts FROM %s", sanitize(tableName),
-			sanitize(schema.Entity), sanitize(schema.Value), sanitize(schema.TS), sanitize(schema.SourceTable.Location()))
-	} else {
-		query = fmt.Sprintf("CREATE VIEW %s AS SELECT %s as entity, %s as value, to_timestamp('%s', 'YYYY-DD-MM HH24:MI:SS +0000 UTC')::TIMESTAMPTZ as ts FROM %s", sanitize(tableName),
-			sanitize(schema.Entity), sanitize(schema.Value), time.UnixMilli(0).UTC(), sanitize(schema.SourceTable.Location()))
-	}
-	fmt.Printf("Resource creation query: %s", query)
-	if _, err := db.Exec(query); err != nil {
-		wrapped := fferr.NewExecutionError(pt.PostgresOffline.String(), err)
-		wrapped.AddDetail("table_name", tableName)
-		return wrapped
-	}
-	return nil
+func (q postgresSQLQueries) registerResources(db *sql.DB, tableName string, schema ResourceSchema) error {
+	return fferr.NewInternalErrorf("Postgres Offline store does not support registering resources")
 }
 
 func (q postgresSQLQueries) primaryTableRegister(tableName string, sourceName string) string {
 	return fmt.Sprintf("CREATE VIEW %s AS SELECT * FROM %s", sanitize(tableName), sanitize(sourceName))
 }
 
-func (q postgresSQLQueries) materializationCreate(tableName string, sourceName string) []string {
+func (q postgresSQLQueries) materializationCreate(tableName string, schema ResourceSchema) []string {
+	const materializationCreateTemplate = `
+CREATE MATERIALIZED VIEW IF NOT EXISTS {{.tableName}} AS
+WITH OrderedSource AS (
+  SELECT
+    {{.entity}} AS entity,
+    {{.value}} AS value,
+    {{.tsSelectStatement}} AS ts,
+    ROW_NUMBER() OVER (PARTITION BY {{.entity}} {{.tsOrderByStatement}}) AS rn
+  FROM {{.sourceLocation}}
+)
+SELECT
+  entity,
+  value,
+  ts,
+  ROW_NUMBER() OVER (ORDER BY (entity)) AS row_number
+FROM OrderedSource
+WHERE rn = 1
+`
+	tmpl := template.Must(template.New("materializationCreateTemplate").Parse(materializationCreateTemplate))
+
+	var tsSelectStatement, tsOrderByStatement string
+	if schema.TS != "" {
+		tsSelectStatement = fmt.Sprintf("%s", schema.TS)
+		tsOrderByStatement = fmt.Sprintf("ORDER BY %s DESC", schema.TS)
+	} else {
+		tsSelectStatement = fmt.Sprintf("to_timestamp('%s', 'YYYY-DD-MM HH24:MI:SS +0000 UTC')::TIMESTAMPTZ", time.UnixMilli(0).UTC())
+		tsOrderByStatement = ""
+	}
+
+	values := map[string]any{
+		"tableName":          sanitize(tableName),
+		"entity":             schema.Entity,
+		"value":              schema.Value,
+		"tsSelectStatement":  tsSelectStatement,
+		"tsOrderByStatement": tsOrderByStatement,
+		// TODO: Error checking for SQLLocation
+		"sourceLocation": helper.SanitizeLocation(*schema.SourceTable.(*pl.SQLLocation)),
+	}
+
+	var sb strings.Builder
+	err := tmpl.Execute(&sb, values)
+	if err != nil {
+		panic("TODO: Refactor to make error-able")
+	}
+
 	return []string{
-		fmt.Sprintf(
-			"CREATE MATERIALIZED VIEW IF NOT EXISTS %s AS (SELECT entity, value, ts, row_number() over(ORDER BY (SELECT NULL)) as row_number FROM "+
-				"(SELECT entity, ts, value, row_number() OVER (PARTITION BY entity ORDER BY ts desc) "+
-				"AS rn FROM %s) t WHERE rn=1);", sanitize(tableName), sanitize(sourceName)),
+		sb.String(),
+		//fmt.Sprintf(
+		//	"CREATE MATERIALIZED VIEW IF NOT EXISTS %s AS (SELECT entity, value, ts, row_number() over(ORDER BY (SELECT NULL)) as row_number FROM "+
+		//	
```

#### Recent Merged Pull Requests:
- **PR #1639** (2025-05-16): Materialization and Trainingsets to use datasets (@aolfat)
- **PR #1638** (2025-05-16): New native types (@aolfat)
- **PR #1637** (2025-05-15): Move all non-secret env variables to vars (@ghost)
- **PR #1635** (2025-04-24): Bug: Add entity to feature equivalence (@aolfat)
- **PR #1634** (closed): Datasets: Add training Set Iterator (@aolfat)
- **PR #1633** (closed): Add Datasets to Materializations (@aolfat)
- **PR #1632** (2025-04-15): Add rest of primary table adjustments (@aolfat)
- **PR #1631** (2025-04-14): Minor dataset fixes (@aolfat)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
