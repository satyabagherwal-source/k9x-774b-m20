# Forensic Learning Record (Deep Inspection): PaddlePaddle/PaddleOCR

> **Canonical Artifact**: `07_PROJECT_LEARNING/paddlepaddle-paddleocr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:20:29.016Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PaddlePaddle/PaddleOCR`
- **Description**: Turn any PDF or image document into structured data for your AI. A powerful, lightweight OCR toolkit that bridges the gap between images/PDFs and LLMs. Supports 100+ languages.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 90652 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/__init__.py`
```
# -*- coding: utf-8 -*-
# @Time    : 2019/8/23 21:58
# @Author  : zhoujun
from .util import *
from .metrics import *
from .schedulers import *
from .cal_recall.script import cal_recall_precision_f1
from .ocr_metric import get_metric

```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/cal_recall/__init__.py`
```
# -*- coding: utf-8 -*-
# @Time    : 1/16/19 6:40 AM
# @Author  : zhoujun
from .script import cal_recall_precision_f1

__all__ = ["cal_recall_precision_f1"]

```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/cal_recall/rrc_evaluation_funcs.py`
```
#!/usr/bin/env python2
# encoding: UTF-8
import json
import sys

sys.path.append("./")
import zipfile
import re
import sys
import os
import codecs
import traceback
import numpy as np
from utils import order_points_clockwise


def print_help():
    sys.stdout.write(
        "Usage: python %s.py -g=<gtFile> -s=<submFile> [-o=<outputFolder> -p=<jsonParams>]"
        % sys.argv[0]
    )
    sys.exit(2)


def load_zip_file_keys(file, fileNameRegExp=""):
    """
    Returns an array with the entries of the ZIP file that match with the regular expression.
    The key's are the names or the file or the capturing group defined in the fileNameRegExp
    """
    try:
        archive = zipfile.ZipFile(file, mode="r", allowZip64=True)
    except:
        raise Exception("Error loading the ZIP archive.")

    pairs = []

    for name in archive.namelist():
        addFile = True
        keyName = name
        if fileNameRegExp != "":
            m = re.match(fileNameRegExp, name)
            if m == None:
                addFile = False
            else:
                if len(m.groups()) > 0:
                    keyName = m.group(1)

        if addFile:
            pairs.append(keyName)

    return pairs


def load_zip_file(file, fileNameRegExp="", allEntries=False):
    """
    Returns an array with the contents (filtered by fileNameRegExp) of a ZIP file.
    The key's are the names or the file or the capturing group defined in the fileNameRegExp
    allEntries validates that all entries in the ZIP file pass the fileNameRegExp
    """
    try:
        archive = zipfile.ZipFile(file, mode="r", allowZip64=True)
    except:
        raise Exception("Error loading the ZIP archive")

    pairs = []
    for name in archive.namelist():
        addFile = True
        keyName = name
        if fileNameRegExp != "":
            m = re.match(fileNameRegExp, name)
            if m == None:
                addFile = False
            else:
                if len(m.groups()) > 0:
                    keyName = m.group(1)

        if addFile:
            pairs.append([keyName, archive.read(name)])
        else:
            if allEntries:
                raise Exception("ZIP entry not valid: %s" % name)

    return dict(pairs)


def load_folder_file(file, fileNameRegExp="", allEntries=False):
    """
    Returns an array with the contents (filtered by fileNameRegExp) of a ZIP file.
    The key's are the names or the file or the capturing group defined in the fileNameRegExp
    allEntries validates that all entries in the ZIP file pass the fileNameRegExp
    """
    pairs = []
    for name in os.listdir(file):
        addFile = True
        keyName = name
        if fileNameRegExp != "":
            m = re.match(fileNameRegExp, name)
            if m == None:
                addFile = False
            else:
                if len(m.groups()) > 0:
                    keyName = m.group(1)

        if addFile:
            pairs.append([keyName, open(os.path.join(file, name)).read()])
        else:
            if allEntries:
                raise Exception("ZIP entry not valid: %s" % name)

    return dict(pairs)


def decode_utf8(raw):
    """
    Returns a Unicode object on success, or None on failure
    """
    try:
        raw = codecs.decode(raw, "utf-8", "replace")
        # extracts BOM if exists
        raw = raw.encode("utf8")
        if raw.startswith(codecs.BOM_UTF8):
            raw = raw.replace(codecs.BOM_UTF8, "", 1)
        return raw.decode("utf-8")
    except:
        return None


def validate_lines_in_file(
    fileName,
    file_contents,
    CRLF=True,
    LTRB=True,
    withTranscription=False,
    withConfidence=False,
    imWidth=0,
    imHeight=0,
):
    """
    This function validates that all lines of the file calling the Line validation function for each line
    """
    utf8File = decode_utf8(file_contents)
    if utf8File is None:
        raise Exception("The file %s is not UTF-8" % fileName)

    lines = utf8File.split("\r\n" if CRLF else "\n")
    for line in lines:
        line = line.replace("\r", "").replace("\n", "")
        if line != "":
            try:
                validate_tl_line(
                    line, LTRB, withTranscription, withConfidence, imWidth, imHeight
                )
            except Exception as e:
                raise Exception(
                    (
                        "Line in sample not valid. Sample: %s Line: %s Error: %s"
                        % (fileName, line, str(e))
                    ).encode("utf-8", "replace")
                )


def validate_tl_line(
    line, LTRB=True, withTranscription=True, withConfidence=True, imWidth=0, imHeight=0
):
    """
    Validate the format of the line. If the line is not valid an exception will be raised.
    If maxWidth and maxHeight are specified, all points must be inside the image bounds.
    Possible values are:
    LTRB=True: xmin,ymin,xmax,ymax[,confidence][,transcription]
    LTRB=False: x1,y1,x2,y2,x3,y3,x4,y4[,confidence][,transcription]
    """
    get_tl_line_values(line, LTRB, withTranscription, withConfidence, imWidth, imHeight)


def get_tl_line_values(
    line,
    LTRB=True,
    withTranscription=False,
    withConfidence=False,
    imWidth=0,
    imHeight=0,
):
    """
    Validate the format of the line. If the line is not valid an exception will be raised.
    If maxWidth and maxHeight are specified, all points must be inside the image bounds.
    Possible values are:
    LTRB=True: xmin,ymin,xmax,ymax[,confidence][,transcription]
    LTRB=False: x1,y1,x2,y2,x3,y3,x4,y4[,confidence][,transcription]
    Returns values from a textline. Points , [Confidences], [Transcriptions]
    """
    confidence = 0.0
    transcription = ""
    points = []

    numPoints = 4

    if LTRB:
        numPoints = 4

        if withTranscription and withConfidence:
            m = re.match(
                r"^\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-1].?[0-9]*)\s*,(.*)$",
                line,
            )
            if m == None:
                m = re.match(
                    r"^\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-1].?[0-9]*)\s*,(.*)$",
                    line,
                )
                raise Exception(
                    "Format incorrect. Should be: xmin,ymin,xmax,ymax,confidence,transcription"
                )
        elif withConfidence:
            m = re.match(
                r"^\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-1].?[0-9]*)\s*$",
                line,
            )
            if m == None:
                raise Exception(
                    "Format incorrect. Should be: xmin,ymin,xmax,ymax,confidence"
                )
        elif withTranscription:
            m = re.match(
                r"^\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,(.*)$",
                line,
            )
            if m == None:
                raise Exception(
                    "Format incorrect. Should be: xmin,ymin,xmax,ymax,transcription"
                )
        else:
            m = re.match(
                r"^\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,?\s*$",
                line,
            )
            if m == None:
                raise Exception("Format incorrect. Should be: xmin,ymin,xmax,ymax")

        xmin = int(m.group(1))
        ymin = int(m.group(2))
        xmax = int(m.group(3))
        ymax = int(m.group(4))
        if xmax < xmin:
            raise Exception("Xmax value (%s) not valid (Xmax < Xmin)." % (xmax))
        if ymax < ymin:
            raise Exception("Ymax value (%s)  not valid (Ymax < Ymin)." % (ymax))

        points = [float(m.group(i)) for i in range(1, (numPoints + 1))]

        if imWidth > 0 and imHeight > 0:
            validate_point_inside_bounds(xmin, ymin, imWidth, imHeight)
            validate_point_inside_bounds(xmax, ymax, imWidth, imHeight)

    else:
        numPoints = 8

        if withTranscription and withConfidence:
            m = re.match(
                r"^\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*([0-1].?[0-9]*)\s*,(.*)$",
                line,
            )
            if m == None:
                raise Exception(
                    "Format incorrect. Should be: x1,y1,x2,y2,x3,y3,x4,y4,confidence,transcription"
                )
        elif withConfidence:
            m = re.match(
                r"^\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*([0-1].?[0-9]*)\s*$",
                line,
            )
            if m == None:
                raise Exception(
                    "Format incorrect. Should be: x1,y1,x2,y2,x3,y3,x4,y4,confidence"
                )
        elif withTranscription:
            m = re.match(
                r"^\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,(.*)$",
                line,
            )
            if m == None:
                raise Exception(
                    "Format incorrect. Should be: x1,y1,x2,y2,x3,y3,x4,y4,transcription"
                )
        else:
            m = re.match(
                r"^\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*,\s*(-?[0-9]+)\s*$",
                line,
            )
            if m == None:
                raise Exception("Format incorrect. Should be: x1,y1,x2,y2,x3,y3,x4,y4")

        points = [float(m.group(i)) for i in range(1, (numPoints + 1))]

        points = order_points_clockwise(np.array(points).reshape(-1, 2)).reshape(-1)
        validate_clockwise_points(points)

        if imWidth > 0 and imHeight > 0:
            validate_point_inside_bounds(points[0], points[1], imWidth,
```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/cal_recall/script.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
from collections import namedtuple
from . import rrc_evaluation_funcs
import Polygon as plg
import numpy as np


def default_evaluation_params():
    """
    default_evaluation_params: Default parameters to use for the validation and evaluation.
    """
    return {
        "IOU_CONSTRAINT": 0.5,
        "AREA_PRECISION_CONSTRAINT": 0.5,
        "GT_SAMPLE_NAME_2_ID": "gt_img_([0-9]+).txt",
        "DET_SAMPLE_NAME_2_ID": "res_img_([0-9]+).txt",
        "LTRB": False,  # LTRB:2points(left,top,right,bottom) or 4 points(x1,y1,x2,y2,x3,y3,x4,y4)
        "CRLF": False,  # Lines are delimited by Windows CRLF format
        "CONFIDENCES": False,  # Detections must include confidence value. AP will be calculated
        "PER_SAMPLE_RESULTS": True,  # Generate per sample results and produce data for visualization
    }


def validate_data(gtFilePath, submFilePath, evaluationParams):
    """
    Method validate_data: validates that all files in the results folder are correct (have the correct name contents).
                            Validates also that there are no missing files in the folder.
                            If some error detected, the method raises the error
    """
    gt = rrc_evaluation_funcs.load_folder_file(
        gtFilePath, evaluationParams["GT_SAMPLE_NAME_2_ID"]
    )

    subm = rrc_evaluation_funcs.load_folder_file(
        submFilePath, evaluationParams["DET_SAMPLE_NAME_2_ID"], True
    )

    # Validate format of GroundTruth
    for k in gt:
        rrc_evaluation_funcs.validate_lines_in_file(
            k, gt[k], evaluationParams["CRLF"], evaluationParams["LTRB"], True
        )

    # Validate format of results
    for k in subm:
        if (k in gt) == False:
            raise Exception("The sample %s not present in GT" % k)

        rrc_evaluation_funcs.validate_lines_in_file(
            k,
            subm[k],
            evaluationParams["CRLF"],
            evaluationParams["LTRB"],
            False,
            evaluationParams["CONFIDENCES"],
        )


def evaluate_method(gtFilePath, submFilePath, evaluationParams):
    """
    Method evaluate_method: evaluate method and returns the results
        Results. Dictionary with the following values:
        - method (required)  Global method metrics. Ex: { 'Precision':0.8,'Recall':0.9 }
        - samples (optional) Per sample metrics. Ex: {'sample1' : { 'Precision':0.8,'Recall':0.9 } , 'sample2' : { 'Precision':0.8,'Recall':0.9 }
    """

    def polygon_from_points(points):
        """
        Returns a Polygon object to use with the Polygon2 class from a list of 8 points: x1,y1,x2,y2,x3,y3,x4,y4
        """
        resBoxes = np.empty([1, 8], dtype="int32")
        resBoxes[0, 0] = int(points[0])
        resBoxes[0, 4] = int(points[1])
        resBoxes[0, 1] = int(points[2])
        resBoxes[0, 5] = int(points[3])
        resBoxes[0, 2] = int(points[4])
        resBoxes[0, 6] = int(points[5])
        resBoxes[0, 3] = int(points[6])
        resBoxes[0, 7] = int(points[7])
        pointMat = resBoxes[0].reshape([2, 4]).T
        return plg.Polygon(pointMat)

    def rectangle_to_polygon(rect):
        resBoxes = np.empty([1, 8], dtype="int32")
        resBoxes[0, 0] = int(rect.xmin)
        resBoxes[0, 4] = int(rect.ymax)
        resBoxes[0, 1] = int(rect.xmin)
        resBoxes[0, 5] = int(rect.ymin)
        resBoxes[0, 2] = int(rect.xmax)
        resBoxes[0, 6] = int(rect.ymin)
        resBoxes[0, 3] = int(rect.xmax)
        resBoxes[0, 7] = int(rect.ymax)

        pointMat = resBoxes[0].reshape([2, 4]).T

        return plg.Polygon(pointMat)

    def rectangle_to_points(rect):
        points = [
            int(rect.xmin),
            int(rect.ymax),
            int(rect.xmax),
            int(rect.ymax),
            int(rect.xmax),
            int(rect.ymin),
            int(rect.xmin),
            int(rect.ymin),
        ]
        return points

    def get_union(pD, pG):
        areaA = pD.area()
        areaB = pG.area()
        return areaA + areaB - get_intersection(pD, pG)

    def get_intersection_over_union(pD, pG):
        try:
            return get_intersection(pD, pG) / get_union(pD, pG)
        except:
            return 0

    def get_intersection(pD, pG):
        pInt = pD & pG
        if len(pInt) == 0:
            return 0
        return pInt.area()

    def compute_ap(confList, matchList, numGtCare):
        correct = 0
        AP = 0
        if len(confList) > 0:
            confList = np.array(confList)
            matchList = np.array(matchList)
            sorted_ind = np.argsort(-confList)
            confList = confList[sorted_ind]
            matchList = matchList[sorted_ind]
            for n in range(len(confList)):
                match = matchList[n]
                if match:
                    correct += 1
                    AP += float(correct) / (n + 1)

            if numGtCare > 0:
                AP /= numGtCare

        return AP

    perSampleMetrics = {}

    matchedSum = 0

    Rectangle = namedtuple("Rectangle", "xmin ymin xmax ymax")

    gt = rrc_evaluation_funcs.load_folder_file(
        gtFilePath, evaluationParams["GT_SAMPLE_NAME_2_ID"]
    )
    subm = rrc_evaluation_funcs.load_folder_file(
        submFilePath, evaluationParams["DET_SAMPLE_NAME_2_ID"], True
    )

    numGlobalCareGt = 0
    numGlobalCareDet = 0

    arrGlobalConfidences = []
    arrGlobalMatches = []

    for resFile in gt:
        gtFile = gt[resFile]  # rrc_evaluation_funcs.decode_utf8(gt[resFile])
        recall = 0
        precision = 0
        hmean = 0

        detMatched = 0

        iouMat = np.empty([1, 1])

        gtPols = []
        detPols = []

        gtPolPoints = []
        detPolPoints = []

        # Array of Ground Truth Polygons' keys marked as don't Care
        gtDontCarePolsNum = []
        # Array of Detected Polygons' matched with a don't Care GT
        detDontCarePolsNum = []

        pairs = []
        detMatchedNums = []

        arrSampleConfidences = []
        arrSampleMatch = []
        sampleAP = 0

        evaluationLog = ""

        (
            pointsList,
            _,
            transcriptionsList,
        ) = rrc_evaluation_funcs.get_tl_line_values_from_file_contents(
            gtFile, evaluationParams["CRLF"], evaluationParams["LTRB"], True, False
        )
        for n in range(len(pointsList)):
            points = pointsList[n]
            transcription = transcriptionsList[n]
            dontCare = transcription == "###"
            if evaluationParams["LTRB"]:
                gtRect = Rectangle(*points)
                gtPol = rectangle_to_polygon(gtRect)
            else:
                gtPol = polygon_from_points(points)
            gtPols.append(gtPol)
            gtPolPoints.append(points)
            if dontCare:
                gtDontCarePolsNum.append(len(gtPols) - 1)

        evaluationLog += (
            "GT polygons: "
            + str(len(gtPols))
            + (
                " (" + str(len(gtDontCarePolsNum)) + " don't care)\n"
                if len(gtDontCarePolsNum) > 0
                else "\n"
            )
        )

        if resFile in subm:
            detFile = subm[resFile]  # rrc_evaluation_funcs.decode_utf8(subm[resFile])

            (
                pointsList,
                confidencesList,
                _,
            ) = rrc_evaluation_funcs.get_tl_line_values_from_file_contents(
                detFile,
                evaluationParams["CRLF"],
                evaluationParams["LTRB"],
                False,
                evaluationParams["CONFIDENCES"],
            )
            for n in range(len(pointsList)):
                points = pointsList[n]

                if evaluationParams["LTRB"]:
                    detRect = Rectangle(*points)
                    detPol = rectangle_to_polygon(detRect)
                else:
                    detPol = polygon_from_points(points)
                detPols.append(detPol)
                detPolPoints.append(points)
                if len(gtDontCarePolsNum) > 0:
                    for dontCarePol in gtDontCarePolsNum:
                        dontCarePol = gtPols[dontCarePol]
                        intersected_area = get_intersection(dontCarePol, detPol)
                        pdDimensions = detPol.area()
                        precision = (
                            0 if pdDimensions == 0 else intersected_area / pdDimensions
                        )
                        if precision > evaluationParams["AREA_PRECISION_CONSTRAINT"]:
                            detDontCarePolsNum.append(len(detPols) - 1)
                            break

            evaluationLog += (
                "DET polygons: "
                + str(len(detPols))
                + (
                    " (" + str(len(detDontCarePolsNum)) + " don't care)\n"
                    if len(detDontCarePolsNum) > 0
                    else "\n"
                )
            )

            if len(gtPols) > 0 and len(detPols) > 0:
                # Calculate IoU and precision matrixs
                outputShape = [len(gtPols), len(detPols)]
                iouMat = np.empty(outputShape)
                gtRectMat = np.zeros(len(gtPols), np.int8)
                detRectMat = np.zeros(len(detPols), np.int8)
                for gtNum in range(len(gtPols)):
                    for detNum in range(len(detPols)):
                        pG = gtPols[gtNum]
                        pD = detPols[detNum]
                        iouMat[gtNum, detNum] = get_intersection_over_union(pD, pG)

                for gtNum in range(len(gtPols)):
                    for detNum in range(len(detPols)):
                        if (
                            gtRectMat[gtNum] == 0
                            and detRectMat[detNum] == 0
                            and gtNum not in gtDontCarePolsNum
                            and detNum not in detDontCarePolsNum
                   
```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/compute_mean_std.py`
```
# -*- coding: utf-8 -*-
# @Time    : 2019/12/7 14:46
# @Author  : zhoujun

import numpy as np
import cv2
import os
import random
from tqdm import tqdm

# calculate means and std
train_txt_path = "./train_val_list.txt"

CNum = 10000  # 挑选多少图片进行计算

img_h, img_w = 640, 640
imgs = np.zeros([img_w, img_h, 3, 1])
means, stdevs = [], []

with open(train_txt_path, "r") as f:
    lines = f.readlines()
    random.shuffle(lines)  # shuffle , 随机挑选图片

    for i in tqdm(range(CNum)):
        img_path = lines[i].split("\t")[0]

        img = cv2.imread(img_path)
        img = cv2.resize(img, (img_h, img_w))
        img = img[:, :, :, np.newaxis]

        imgs = np.concatenate((imgs, img), axis=3)
#         print(i)

imgs = imgs.astype(np.float32) / 255.0

for i in tqdm(range(3)):
    pixels = imgs[:, :, i, :].ravel()  # 拉成一行
    means.append(np.mean(pixels))
    stdevs.append(np.std(pixels))

# cv2 读取的图像格式为BGR，PIL/Skimage读取到的都是RGB不用转
means.reverse()  # BGR --> RGB
stdevs.reverse()

print("normMean = {}".format(means))
print("normStd = {}".format(stdevs))
print("transforms.Normalize(normMean = {}, normStd = {})".format(means, stdevs))

```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/make_trainfile.py`
```
# -*- coding: utf-8 -*-
# @Time    : 2019/8/24 12:06
# @Author  : zhoujun
import os
import glob
import pathlib

data_path = r"test"
# data_path/img 存放图片
# data_path/gt 存放标签文件

f_w = open(os.path.join(data_path, "test.txt"), "w", encoding="utf8")
for img_path in glob.glob(data_path + "/img/*.jpg", recursive=True):
    d = pathlib.Path(img_path)
    label_path = os.path.join(data_path, "gt", ("gt_" + str(d.stem) + ".txt"))
    if os.path.exists(img_path) and os.path.exists(label_path):
        print(img_path, label_path)
    else:
        print("不存在", img_path, label_path)
    f_w.write("{}\t{}\n".format(img_path, label_path))
f_w.close()

```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/metrics.py`
```
# Adapted from score written by wkentaro
# https://github.com/wkentaro/pytorch-fcn/blob/master/torchfcn/utils.py

import numpy as np


class runningScore(object):
    def __init__(self, n_classes):
        self.n_classes = n_classes
        self.confusion_matrix = np.zeros((n_classes, n_classes))

    def _fast_hist(self, label_true, label_pred, n_class):
        mask = (label_true >= 0) & (label_true < n_class)

        if np.sum((label_pred[mask] < 0)) > 0:
            print(label_pred[label_pred < 0])
        hist = np.bincount(
            n_class * label_true[mask].astype(int) + label_pred[mask],
            minlength=n_class**2,
        ).reshape(n_class, n_class)
        return hist

    def update(self, label_trues, label_preds):
        # print label_trues.dtype, label_preds.dtype
        for lt, lp in zip(label_trues, label_preds):
            try:
                self.confusion_matrix += self._fast_hist(
                    lt.flatten(), lp.flatten(), self.n_classes
                )
            except:
                pass

    def get_scores(self):
        """Returns accuracy score evaluation result.
        - overall accuracy
        - mean accuracy
        - mean IU
        - fwavacc
        """
        hist = self.confusion_matrix
        acc = np.diag(hist).sum() / (hist.sum() + 0.0001)
        acc_cls = np.diag(hist) / (hist.sum(axis=1) + 0.0001)
        acc_cls = np.nanmean(acc_cls)
        iu = np.diag(hist) / (
            hist.sum(axis=1) + hist.sum(axis=0) - np.diag(hist) + 0.0001
        )
        mean_iu = np.nanmean(iu)
        freq = hist.sum(axis=1) / (hist.sum() + 0.0001)
        fwavacc = (freq[freq > 0] * iu[freq > 0]).sum()
        cls_iu = dict(zip(range(self.n_classes), iu))

        return {
            "Overall Acc": acc,
            "Mean Acc": acc_cls,
            "FreqW Acc": fwavacc,
            "Mean IoU": mean_iu,
        }, cls_iu

    def reset(self):
        self.confusion_matrix = np.zeros((self.n_classes, self.n_classes))

```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/ocr_metric/__init__.py`
```
# -*- coding: utf-8 -*-
# @Time    : 2019/12/5 15:36
# @Author  : zhoujun
from .icdar2015 import QuadMetric


def get_metric(config):
    try:
        if "args" not in config:
            args = {}
        else:
            args = config["args"]
        if isinstance(args, dict):
            cls = eval(config["type"])(**args)
        else:
            cls = eval(config["type"])(args)
        return cls
    except:
        return None

```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/ocr_metric/icdar2015/__init__.py`
```
# -*- coding: utf-8 -*-
# @Time    : 2019/12/5 15:36
# @Author  : zhoujun

from .quad_metric import QuadMetric

```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/ocr_metric/icdar2015/detection/deteval.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import math
from collections import namedtuple
import numpy as np
from shapely.geometry import Polygon


class DetectionDetEvalEvaluator(object):
    def __init__(
        self,
        area_recall_constraint=0.8,
        area_precision_constraint=0.4,
        ev_param_ind_center_diff_thr=1,
        mtype_oo_o=1.0,
        mtype_om_o=0.8,
        mtype_om_m=1.0,
    ):
        self.area_recall_constraint = area_recall_constraint
        self.area_precision_constraint = area_precision_constraint
        self.ev_param_ind_center_diff_thr = ev_param_ind_center_diff_thr
        self.mtype_oo_o = mtype_oo_o
        self.mtype_om_o = mtype_om_o
        self.mtype_om_m = mtype_om_m

    def evaluate_image(self, gt, pred):
        def get_union(pD, pG):
            return Polygon(pD).union(Polygon(pG)).area

        def get_intersection_over_union(pD, pG):
            return get_intersection(pD, pG) / get_union(pD, pG)

        def get_intersection(pD, pG):
            return Polygon(pD).intersection(Polygon(pG)).area

        def one_to_one_match(row, col):
            cont = 0
            for j in range(len(recallMat[0])):
                if (
                    recallMat[row, j] >= self.area_recall_constraint
                    and precisionMat[row, j] >= self.area_precision_constraint
                ):
                    cont = cont + 1
            if cont != 1:
                return False
            cont = 0
            for i in range(len(recallMat)):
                if (
                    recallMat[i, col] >= self.area_recall_constraint
                    and precisionMat[i, col] >= self.area_precision_constraint
                ):
                    cont = cont + 1
            if cont != 1:
                return False

            if (
                recallMat[row, col] >= self.area_recall_constraint
                and precisionMat[row, col] >= self.area_precision_constraint
            ):
                return True
            return False

        def num_overlaps_gt(gtNum):
            cont = 0
            for detNum in range(len(detRects)):
                if detNum not in detDontCareRectsNum:
                    if recallMat[gtNum, detNum] > 0:
                        cont = cont + 1
            return cont

        def num_overlaps_det(detNum):
            cont = 0
            for gtNum in range(len(recallMat)):
                if gtNum not in gtDontCareRectsNum:
                    if recallMat[gtNum, detNum] > 0:
                        cont = cont + 1
            return cont

        def is_single_overlap(row, col):
            if num_overlaps_gt(row) == 1 and num_overlaps_det(col) == 1:
                return True
            else:
                return False

        def one_to_many_match(gtNum):
            many_sum = 0
            detRects = []
            for detNum in range(len(recallMat[0])):
                if (
                    gtRectMat[gtNum] == 0
                    and detRectMat[detNum] == 0
                    and detNum not in detDontCareRectsNum
                ):
                    if precisionMat[gtNum, detNum] >= self.area_precision_constraint:
                        many_sum += recallMat[gtNum, detNum]
                        detRects.append(detNum)
            if round(many_sum, 4) >= self.area_recall_constraint:
                return True, detRects
            else:
                return False, []

        def many_to_one_match(detNum):
            many_sum = 0
            gtRects = []
            for gtNum in range(len(recallMat)):
                if (
                    gtRectMat[gtNum] == 0
                    and detRectMat[detNum] == 0
                    and gtNum not in gtDontCareRectsNum
                ):
                    if recallMat[gtNum, detNum] >= self.area_recall_constraint:
                        many_sum += precisionMat[gtNum, detNum]
                        gtRects.append(gtNum)
            if round(many_sum, 4) >= self.area_precision_constraint:
                return True, gtRects
            else:
                return False, []

        def center_distance(r1, r2):
            return ((np.mean(r1, axis=0) - np.mean(r2, axis=0)) ** 2).sum() ** 0.5

        def diag(r):
            r = np.array(r)
            return (
                (r[:, 0].max() - r[:, 0].min()) ** 2
                + (r[:, 1].max() - r[:, 1].min()) ** 2
            ) ** 0.5

        perSampleMetrics = {}

        recall = 0
        precision = 0
        hmean = 0
        recallAccum = 0.0
        precisionAccum = 0.0
        gtRects = []
        detRects = []
        gtPolPoints = []
        detPolPoints = []
        gtDontCareRectsNum = (
            []
        )  # Array of Ground Truth Rectangles' keys marked as don't Care
        detDontCareRectsNum = (
            []
        )  # Array of Detected Rectangles' matched with a don't Care GT
        pairs = []
        evaluationLog = ""

        recallMat = np.empty([1, 1])
        precisionMat = np.empty([1, 1])

        for n in range(len(gt)):
            points = gt[n]["points"]
            # transcription = gt[n]['text']
            dontCare = gt[n]["ignore"]

            if not Polygon(points).is_valid or not Polygon(points).is_simple:
                continue

            gtRects.append(points)
            gtPolPoints.append(points)
            if dontCare:
                gtDontCareRectsNum.append(len(gtRects) - 1)

        evaluationLog += (
            "GT rectangles: "
            + str(len(gtRects))
            + (
                " (" + str(len(gtDontCareRectsNum)) + " don't care)\n"
                if len(gtDontCareRectsNum) > 0
                else "\n"
            )
        )

        for n in range(len(pred)):
            points = pred[n]["points"]

            if not Polygon(points).is_valid or not Polygon(points).is_simple:
                continue

            detRect = points
            detRects.append(detRect)
            detPolPoints.append(points)
            if len(gtDontCareRectsNum) > 0:
                for dontCareRectNum in gtDontCareRectsNum:
                    dontCareRect = gtRects[dontCareRectNum]
                    intersected_area = get_intersection(dontCareRect, detRect)
                    rdDimensions = Polygon(detRect).area
                    if rdDimensions == 0:
                        precision = 0
                    else:
                        precision = intersected_area / rdDimensions
                    if precision > self.area_precision_constraint:
                        detDontCareRectsNum.append(len(detRects) - 1)
                        break

        evaluationLog += (
            "DET rectangles: "
            + str(len(detRects))
            + (
                " (" + str(len(detDontCareRectsNum)) + " don't care)\n"
                if len(detDontCareRectsNum) > 0
                else "\n"
            )
        )

        if len(gtRects) == 0:
            recall = 1
            precision = 0 if len(detRects) > 0 else 1

        if len(detRects) > 0:
            # Calculate recall and precision matrixes
            outputShape = [len(gtRects), len(detRects)]
            recallMat = np.empty(outputShape)
            precisionMat = np.empty(outputShape)
            gtRectMat = np.zeros(len(gtRects), np.int8)
            detRectMat = np.zeros(len(detRects), np.int8)
            for gtNum in range(len(gtRects)):
                for detNum in range(len(detRects)):
                    rG = gtRects[gtNum]
                    rD = detRects[detNum]
                    intersected_area = get_intersection(rG, rD)
                    rgDimensions = Polygon(rG).area
                    rdDimensions = Polygon(rD).area
                    recallMat[gtNum, detNum] = (
                        0 if rgDimensions == 0 else intersected_area / rgDimensions
                    )
                    precisionMat[gtNum, detNum] = (
                        0 if rdDimensions == 0 else intersected_area / rdDimensions
                    )

            # Find one-to-one matches
            evaluationLog += "Find one-to-one matches\n"
            for gtNum in range(len(gtRects)):
                for detNum in range(len(detRects)):
                    if (
                        gtRectMat[gtNum] == 0
                        and detRectMat[detNum] == 0
                        and gtNum not in gtDontCareRectsNum
                        and detNum not in detDontCareRectsNum
                    ):
                        match = one_to_one_match(gtNum, detNum)
                        if match is True:
                            # in deteval we have to make other validation before mark as one-to-one
                            if is_single_overlap(gtNum, detNum) is True:
                                rG = gtRects[gtNum]
                                rD = detRects[detNum]
                                normDist = center_distance(rG, rD)
                                normDist /= diag(rG) + diag(rD)
                                normDist *= 2.0
                                if normDist < self.ev_param_ind_center_diff_thr:
                                    gtRectMat[gtNum] = 1
                                    detRectMat[detNum] = 1
                                    recallAccum += self.mtype_oo_o
                                    precisionAccum += self.mtype_oo_o
                                    pairs.append(
                                        {"gt": gtNum, "det": detNum, "type": "OO"}
                                    )
                                    evaluationLog += (
                                        "Match GT #"
                                        + str(gtNum)
                                        + " with Det #"
                                        + str(detNum)
                                        + "\n"
                                    )
                                else:
        
```

### Core Architecture Module: `benchmark/PaddleOCR_DBNet/utils/ocr_metric/icdar2015/detection/icdar2013.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
import math
from collections import namedtuple
import numpy as np
from shapely.geometry import Polygon


class DetectionICDAR2013Evaluator(object):
    def __init__(
        self,
        area_recall_constraint=0.8,
        area_precision_constraint=0.4,
        ev_param_ind_center_diff_thr=1,
        mtype_oo_o=1.0,
        mtype_om_o=0.8,
        mtype_om_m=1.0,
    ):
        self.area_recall_constraint = area_recall_constraint
        self.area_precision_constraint = area_precision_constraint
        self.ev_param_ind_center_diff_thr = ev_param_ind_center_diff_thr
        self.mtype_oo_o = mtype_oo_o
        self.mtype_om_o = mtype_om_o
        self.mtype_om_m = mtype_om_m

    def evaluate_image(self, gt, pred):
        def get_union(pD, pG):
            return Polygon(pD).union(Polygon(pG)).area

        def get_intersection_over_union(pD, pG):
            return get_intersection(pD, pG) / get_union(pD, pG)

        def get_intersection(pD, pG):
            return Polygon(pD).intersection(Polygon(pG)).area

        def one_to_one_match(row, col):
            cont = 0
            for j in range(len(recallMat[0])):
                if (
                    recallMat[row, j] >= self.area_recall_constraint
                    and precisionMat[row, j] >= self.area_precision_constraint
                ):
                    cont = cont + 1
            if cont != 1:
                return False
            cont = 0
            for i in range(len(recallMat)):
                if (
                    recallMat[i, col] >= self.area_recall_constraint
                    and precisionMat[i, col] >= self.area_precision_constraint
                ):
                    cont = cont + 1
            if cont != 1:
                return False

            if (
                recallMat[row, col] >= self.area_recall_constraint
                and precisionMat[row, col] >= self.area_precision_constraint
            ):
                return True
            return False

        def one_to_many_match(gtNum):
            many_sum = 0
            detRects = []
            for detNum in range(len(recallMat[0])):
                if (
                    gtRectMat[gtNum] == 0
                    and detRectMat[detNum] == 0
                    and detNum not in detDontCareRectsNum
                ):
                    if precisionMat[gtNum, detNum] >= self.area_precision_constraint:
                        many_sum += recallMat[gtNum, detNum]
                        detRects.append(detNum)
            if round(many_sum, 4) >= self.area_recall_constraint:
                return True, detRects
            else:
                return False, []

        def many_to_one_match(detNum):
            many_sum = 0
            gtRects = []
            for gtNum in range(len(recallMat)):
                if (
                    gtRectMat[gtNum] == 0
                    and detRectMat[detNum] == 0
                    and gtNum not in gtDontCareRectsNum
                ):
                    if recallMat[gtNum, detNum] >= self.area_recall_constraint:
                        many_sum += precisionMat[gtNum, detNum]
                        gtRects.append(gtNum)
            if round(many_sum, 4) >= self.area_precision_constraint:
                return True, gtRects
            else:
                return False, []

        def center_distance(r1, r2):
            return ((np.mean(r1, axis=0) - np.mean(r2, axis=0)) ** 2).sum() ** 0.5

        def diag(r):
            r = np.array(r)
            return (
                (r[:, 0].max() - r[:, 0].min()) ** 2
                + (r[:, 1].max() - r[:, 1].min()) ** 2
            ) ** 0.5

        perSampleMetrics = {}

        recall = 0
        precision = 0
        hmean = 0
        recallAccum = 0.0
        precisionAccum = 0.0
        gtRects = []
        detRects = []
        gtPolPoints = []
        detPolPoints = []
        gtDontCareRectsNum = (
            []
        )  # Array of Ground Truth Rectangles' keys marked as don't Care
        detDontCareRectsNum = (
            []
        )  # Array of Detected Rectangles' matched with a don't Care GT
        pairs = []
        evaluationLog = ""

        recallMat = np.empty([1, 1])
        precisionMat = np.empty([1, 1])

        for n in range(len(gt)):
            points = gt[n]["points"]
            # transcription = gt[n]['text']
            dontCare = gt[n]["ignore"]

            if not Polygon(points).is_valid or not Polygon(points).is_simple:
                continue

            gtRects.append(points)
            gtPolPoints.append(points)
            if dontCare:
                gtDontCareRectsNum.append(len(gtRects) - 1)

        evaluationLog += (
            "GT rectangles: "
            + str(len(gtRects))
            + (
                " (" + str(len(gtDontCareRectsNum)) + " don't care)\n"
                if len(gtDontCareRectsNum) > 0
                else "\n"
            )
        )

        for n in range(len(pred)):
            points = pred[n]["points"]

            if not Polygon(points).is_valid or not Polygon(points).is_simple:
                continue

            detRect = points
            detRects.append(detRect)
            detPolPoints.append(points)
            if len(gtDontCareRectsNum) > 0:
                for dontCareRectNum in gtDontCareRectsNum:
                    dontCareRect = gtRects[dontCareRectNum]
                    intersected_area = get_intersection(dontCareRect, detRect)
                    rdDimensions = Polygon(detRect).area
                    if rdDimensions == 0:
                        precision = 0
                    else:
                        precision = intersected_area / rdDimensions
                    if precision > self.area_precision_constraint:
                        detDontCareRectsNum.append(len(detRects) - 1)
                        break

        evaluationLog += (
            "DET rectangles: "
            + str(len(detRects))
            + (
                " (" + str(len(detDontCareRectsNum)) + " don't care)\n"
                if len(detDontCareRectsNum) > 0
                else "\n"
            )
        )

        if len(gtRects) == 0:
            recall = 1
            precision = 0 if len(detRects) > 0 else 1

        if len(detRects) > 0:
            # Calculate recall and precision matrixes
            outputShape = [len(gtRects), len(detRects)]
            recallMat = np.empty(outputShape)
            precisionMat = np.empty(outputShape)
            gtRectMat = np.zeros(len(gtRects), np.int8)
            detRectMat = np.zeros(len(detRects), np.int8)
            for gtNum in range(len(gtRects)):
                for detNum in range(len(detRects)):
                    rG = gtRects[gtNum]
                    rD = detRects[detNum]
                    intersected_area = get_intersection(rG, rD)
                    rgDimensions = Polygon(rG).area
                    rdDimensions = Polygon(rD).area
                    recallMat[gtNum, detNum] = (
                        0 if rgDimensions == 0 else intersected_area / rgDimensions
                    )
                    precisionMat[gtNum, detNum] = (
                        0 if rdDimensions == 0 else intersected_area / rdDimensions
                    )

            # Find one-to-one matches
            evaluationLog += "Find one-to-one matches\n"
            for gtNum in range(len(gtRects)):
                for detNum in range(len(detRects)):
                    if (
                        gtRectMat[gtNum] == 0
                        and detRectMat[detNum] == 0
                        and gtNum not in gtDontCareRectsNum
                        and detNum not in detDontCareRectsNum
                    ):
                        match = one_to_one_match(gtNum, detNum)
                        if match is True:
                            # in deteval we have to make other validation before mark as one-to-one
                            rG = gtRects[gtNum]
                            rD = detRects[detNum]
                            normDist = center_distance(rG, rD)
                            normDist /= diag(rG) + diag(rD)
                            normDist *= 2.0
                            if normDist < self.ev_param_ind_center_diff_thr:
                                gtRectMat[gtNum] = 1
                                detRectMat[detNum] = 1
                                recallAccum += self.mtype_oo_o
                                precisionAccum += self.mtype_oo_o
                                pairs.append({"gt": gtNum, "det": detNum, "type": "OO"})
                                evaluationLog += (
                                    "Match GT #"
                                    + str(gtNum)
                                    + " with Det #"
                                    + str(detNum)
                                    + "\n"
                                )
                            else:
                                evaluationLog += (
                                    "Match Discarded GT #"
                                    + str(gtNum)
                                    + " with Det #"
                                    + str(detNum)
                                    + " normDist: "
                                    + str(normDist)
                                    + " \n"
                                )
            # Find one-to-many matches
            evaluationLog += "Find one-to-many matches\n"
            for gtNum in range(len(gtRects)):
                if gtNum not in gtDontCareRectsNum:
                    match, matchesDet = one_to_many_match(gtNum)
                    if match is True:
                        evaluationLog += "num_overlaps_gt=" + str(
                            num_overlaps_gt(gtNum)
                        )
                        gtRectMat[gtNum] = 1
                        recallAccum += (
      
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17908** (2026-05-24): **PaddleOCR 在线demo bug: 图像一直在抖动**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  问题链接：https://aistudio.baidu.com/paddleocr/task/file/t-10b4bde00cb0  图像一直在抖动：  ![Image](https://github.com/user-attachments/assets/ef630b3a-9876-4dda-ab79-1b255738c192)  ### 🏃‍♂️ Environment (运行环境)  无  ### 🌰 Minimal Reproducible Example (最小可复现问题的Demo)  无
  **Post-Mortem & Fix Analysis**:
  > 神奇的问题，已反馈前端同学。
  > The issue has no response for a long time and will be closed. You can reopen or new another issue if are still confused.  --- _From Bot_

- **Issue #17651** (2026-03-13): **PaddleOCR VL pipeline crashes with "Pointer C should not be null" on specific landscape pages (vlm worker BLAS error)**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  ### Bug description  When using PaddleOCR with VL + layout detection enabled, the pipeline crashes on a specific page with the following error:  RuntimeError: Exception from the 'vlm' worker: (InvalidArgument) Pointer C should not be null.   [Hint: C should not be null.]   (at paddle/phi/kernels/funcs/blas/blas_impl.h:1943)  The issue consistently occurs on one specific page, while all other pages in the same document are processed successfully.  ### Observed behavior  - The failing page is a landscape (horizontal) page, but it is correctly oriented. - Rotating the page manually (90°) does NOT resolve the issue. - Changing DPI, enabling angle/orientation classification, or re-running inference does NOT resolve the issue.  ### Expected behavior  The VL pipeline should either: - handle landscape pages correctly, or - gracefully handle empty / invalid layout detections without crashing.      ### 🏃‍♂️ Environment (运行环境)  ### Environment  - PaddleOCR version: latest - OS: Windows - Device: CPU  - Layout model: PP-DocLayoutV2 - VL model: PaddleOCR-VL  ###
  **Post-Mortem & Fix Analysis**:
  > Thanks for the feedback, to continue our investigation, could you please provide the file that caused the pipeline to fail? This will allow us to better diagnose the issue.
  > The issue has no response for a long time and will be closed. You can reopen or new another issue if are still confused.  --- _From Bot_

- **Issue #17647** (2026-02-10): **RuntimeError: Exception from the 'cv' worker: too many values to unpack (expected 2)**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  华为arm架构服务器使用docker-compose部署PaddleOCR-VL-1.5       paddleocr-vl-api   paddleocr-vlm-server  均启动成功  报错内容如下：  Checking connectivity to the model hosters, this may take a while. To bypass this check, set `PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK` to `True`. No model hoster is available! Please check your network connection to one of the following model hoster: HuggingFace (https://huggingface.co), ModelScope (https://modelscope.cn), AIStudio (https://aistudio.baidu.com), or BOS (https://paddle-model-ecology.bj.bcebos.com). Otherwise, only local models can be used. Creating model: ('PP-DocLayoutV3', None) Model files already exist. Using cached files. To redownload, please delete the directory manually: `/home/paddleocr/.paddlex/official_models/PP-DocLayoutV3`. I0205 16:21:45.371529     1 init.cc:238] ENV [CUSTOM_DEVICE_ROOT]=/usr/local/lib/python3.10/dist-packages/paddle_custom_device I0205 16:21:45.371572     1 init.cc:146] Try loading custom device libs from: [/usr/local/lib/python3.10/dist-packages/paddle_custom_device] I0205 16:21:46.059719     1 custo
  **Post-Mortem & Fix Analysis**:
  > ### compose.yml    services:     paddleocr-vl-api:       image: ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-vl:latest-huawei-npu-offline       container_name: paddleocr-vl-api       ports:         - 8180:8080       depends_on:         paddleocr-vlm-server:           condition: service_healthy       user: root       restart: unless-stopped       environment:         - VLM_BACKEND=vllm         - ASCEND_RT_VISIBLE_DEVICES=0       command: /bin/bash -c "paddlex --serve --pipeline /home/paddleocr/pipeline_config_vllm.yaml --device npu"       healthcheck:         test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]       volumes:         - /usr/local/Ascend/driver:/usr/local/Ascend/driver         - /usr/local/bin/npu-smi:/usr/local/bin/npu-smi         - /usr/local/dcmi:/usr/local/dcmi         - /data/paddle-vl/pipeline_config_vllm.yaml:/home/paddleocr/pipeline_config_vllm.yaml         - /data/paddle-vl:/data/paddle-vl       privileged: true       shm_size: 64
  > Please update to the latest image and try again. I've tested it and it works. 
  >   已解决，参考 https://github.com/PaddlePaddle/PaddleOCR/pull/17650/changes         在 2026-02-10 11:12:32，"CatJuly" ***@***.***> 写道：  CatJuly left a comment (PaddlePaddle/PaddleOCR#17647)  请问是否解决？我也遇到一样的问题  — Reply to this email directly, view it on GitHub, or unsubscribe. You are receiving this because you authored the thread.Message ID: ***@***.***>

- **Issue #17598** (2026-06-03): **DISABLE_MODEL_SOURCE_CHECK or PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK?**
  *Symptoms*:   ### 🐛 Bug  默认情况下会有如下提示：  > Checking connectivity to the model hosters, this may take a while. To bypass this check, set `DISABLE_MODEL_SOURCE_CHECK` to `True`.   但尝试过各种方法设置环境变量都不行。 搜索了代码发现真正起作用的变量名称是`PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK`  ### 🏃‍♂️ Environment  windows python 3.12  ### 🌰 Minimal Reproducible Example  ```python ocr = PaddleOCR(     text_detection_model_name="PP-OCRv5_mobile_det",     text_recognition_model_name="PP-OCRv5_mobile_rec",     use_doc_orientation_classify=False,     use_doc_unwarping=False,     use_textline_orientation=False,     enable_mkldnn=True,     cpu_threads=10, )  result = ocr.predict(TEST_IMAGE) for res in result:     res.print()     res.save_to_img(OUTPUT_DIR)     res.save_to_json(OUTPUT_DIR) ```
  **Post-Mortem & Fix Analysis**:
  >  `export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True` 我试过是没问题的
  > > `export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True` 我试过是没问题的  你看清楚我的问题重点了吗
  > > > `export PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True` 我试过是没问题的 >  > 你看清楚我的问题重点了吗  抱歉，确实没看清楚；我拉下来的版本，提示的变量就是PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK，跟你遇到的不一样。你可以看看是不是已经Fix了。

- **Issue #17583** (2026-03-09): **paddleocr vl 1.5印章文本识别是不是有问题**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  所有线上体验环节印章文本识别都不生效，只抠图不识别  ### 🏃‍♂️ Environment (运行环境)  [modelscope](https://www.modelscope.cn/studios/PaddlePaddle/PaddleOCR-VL-1.5_Online_Demo) [官网](https://aistudio.baidu.com/paddleocr/task?lang=zh-CN)  ### 🌰 Minimal Reproducible Example (最小可复现问题的Demo)  使用印章文本识别功能
  **Post-Mortem & Fix Analysis**:
  > 抱歉给你造成了不便，我们已经定位到问题，目前紧急修复中！
  > > 抱歉给你造成了不便，我们已经定位到问题，目前紧急修复中！  请问是否有相关修复了，什么时候能发版？ 
  > 已经修复了，可以试试新版本

- **Issue #17537** (2026-02-06): **always Run Paddle-TRT Dynamic Shape mode.！！**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  使用deploy中的cpp_infer，导出为dll，在运行时，ocr_cls总是会进行一次Paddle-TRT Dynamic Shape mode。 1. 一定会进行，除非不使用tensorrt。 2. 选用int8 精度，paddleinference.dll会报错。 3. 无论哪一行代码，都会导致它进行转化。 4. 在第一次运行，也就是config.CollectShapeRangeInfo("./trt_cls_shape.txt");时，图片数量要是多了，会内存泄漏。 5. 从第二次开始，设置了config.EnableTunedTensorRtDynamicShape("./trt_cls_shape.txt", false);一定会进行dynamicshape。 6. 具体的增强细节，都被封装在了CreatePredictor，无从得知具体流程。、‘’ 7.即便EnableSaveOptimModel，也无法直接使用该优化后的模型，跳过编译。 8. 只要没有‘trt_cls_shape.txt’这个文件，图片数量一多，就一定会内存泄漏。   ### 🏃‍♂️ Environment (运行环境)  OS : Windows ppocr 2.10 geforce 4060.   ### 🌰 Minimal Reproducible Example (最小可复现问题的Demo)  #include <windows.h> #include <opencv2/opencv.hpp> #include <iostream> #include <iomanip>  // 用于格式化输出时间 #include "ocr_config.h"  // 定义结果结构体（需要与DLL中的一致） struct OCRPredictResult {     std::vector<std::vector<int>> box;     std::string text;     float score = -1.0f;     float cls_score = 0.0f;     int cls_label = -1; };  // 定义函数指针类型 typedef void* (*InitOcrDetectorFunc)(const OCR_Config*); typedef int (*PredictFunc)(void*, const cv::Mat*, C_OCRPredictResult*
  **Post-Mortem & Fix Analysis**:
  > 抱歉，由于我们精力有限，3.0以下版本暂时无人力维护，感谢您的支持。

- **Issue #17531** (2026-05-08): **windows 上编译cpp_infer 文档不对,无法正常generate 生成vs solution(至少我电脑上一步步安装不对)**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)  CMake GUI 按照文档一步步操作（我甚至放弃了我vcpkg 安装的opencv），最后generate 的时候疯狂报错：OpenCV STATIC: OFF CMake Warning at D:/3rd/opencv/sources/build/install/OpenCVConfig.cmake:190 (message):   Found OpenCV Windows Pack but it has no binaries compatible with your   configuration.    You should manually point CMake variable OpenCV_DIR to your build of OpenCV   library. Call Stack (most recent call first):   CMakeLists.txt:58 (find_package)   CMake Error at CMakeLists.txt:58 (find_package):   Found package configuration file:      D:/3rd/opencv/sources/build/install/OpenCVConfig.cmake    but it set OpenCV_FOUND to FALSE so package "OpenCV" is considered to be   NOT FOUND.  <img width="819" height="664" alt="Image" src="https://github.com/user-attachments/assets/5945a919-116c-490d-8974-c1cefe6bb546" />  最后解决方案是（也就是OPENCV_DIR  OpenCV_DIR 是两个不一样的值，但是文档是一样的）  cmake -S . -B build `   -DOPENCV_DIR=D:/3rd/opencv/sources/build/install `   -DOpenCV_DIR=D:/3rd/opencv/sources/build/install/lib/cmake/opencv4 `   -DPADDLE_LIB=D:/3rd/paddle_inference  (我又复现了一遍，本质是ppocr cmakelist set(OpenC
  **Post-Mortem & Fix Analysis**:
  > This issue is stale because it has been open for 90 days with no activity.
  > This issue was closed because it has been inactive for 14 days since being marked as stale.

- **Issue #17528** (2026-02-22): **Segmentation fault in Docker container**
  *Symptoms*: ### 🔎 Search before asking  - [x] I have searched the PaddleOCR [Docs](https://paddlepaddle.github.io/PaddleOCR/) and found no similar bug report. - [x] I have searched the PaddleOCR [Issues](https://github.com/PaddlePaddle/PaddleOCR/issues) and found no similar bug report. - [x] I have searched the PaddleOCR [Discussions](https://github.com/PaddlePaddle/PaddleOCR/discussions) and found no similar bug report.  ### 🐛 Bug (问题描述)    --------------------------------------                                                                                                                                                                                                                                                                                                                                                                                                                                                                    C++ Traceback (most recent call last):                                                                                                                                                                                                                                                                                                                                                                                                                                                                    --------------------------------------                                              
  **Post-Mortem & Fix Analysis**:
  > Hi, thank you for the feedback. Can you provide more information on how this is triggered?
  > The issue has no response for a long time and will be closed. You can reopen or new another issue if are still confused.  --- _From Bot_

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

### Incident Patch 1: `211989f0` (2026-06-26)
**Commit Message**: ci: stop using paths-ignore on required checks; short-circuit docs-only via composite action (#18219)

* ci: add detect-docs-only composite action

Centralizes docs-only detection so required workflows can always trigger
and short-circuit cleanly instead of using paths-ignore (which hangs
required status checks on docs-only PRs).

* ci(codestyle): drop paths-ignore; short-circuit on docs-only

Replaces paths-ignore (which caused required check to hang on docs-only
PRs) with step-level if: gating driven by detect-docs-only composite
action. Job name preserved for branch-protection compatibility.

* ci(tests): drop dorny/paths-filter; use detect-docs-only

Replaces the third-party paths-filter with the in-repo composite action
for a single source of truth. Also removes the residual empty
paths-ignore: key under on.pull_request to prevent regressions.

* ci(test_gpu): drop paths-ignore; unify on detect-docs-only

Removes external paths-ignore that conflicted with the internal aggregator
pattern (causing required check test-pr-gpu to hang on docs-only PRs).
Replaces the hand-written git diff block with the detect-docs-only
composite action. Renames output skip_gpu to docs_only for cons

**File**: `.github/actions/detect-docs-only/action.yml` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+name: Detect Docs-Only Change
+description: >
+  Output docs_only=true if every changed file in the current pull_request
+  matches docs/**, **/*.md, or .github/**. On push or workflow_dispatch,
+  always output docs_only=false.
+outputs:
+  docs_only:
+    description: "true if change is docs-only, otherwise false"
+    value: ${{ steps.compute.outputs.docs_only }}
+runs:
+  using: composite
+  steps:
+    - id: compute
+      shell: bash
+      env:
+        GITHUB_EVENT_NAME: ${{ github.event_name }}
+        GITHUB_BASE_REF: ${{ github.base_ref }}
+      run: |
+        set -euo pipefail
+        if [ "${GITHUB_EVENT_NAME}" != "pull_request" ]; then
+          echo "docs_only=false" >> "$GITHUB_OUTPUT"
+          exit 0
+        fi
+        git fetch origin "${GITHUB_BASE_REF}" --depth=1 >/dev/null 2>&1 || true
+        CHANGED_FILES="$(git diff --name-only "origin/${GITHUB_BASE_REF}...HEAD")"
+        # >>> matcher-begin
+        shopt -s globstar extglob nullglob
+        is_docs_only() {
+          local files="$1"
+          if [ -z "$files" ]; then
+            echo "false"; return 0
+          fi
+          while IFS= read -r f; do
+            [ -z "$f" ] && continue
+            case "$f" in
+              docs/*) ;;
+              .github/*) ;;
+              *.md) ;;
+              *)
+                # also accept nested */**/*.md via case glob
+                case "$f" in
+                  */*.md) ;;
+                  *) echo "false"; return 0 ;;
+                esac
+                ;;
+            esac
+          done <<< "$files"
+          echo "true"
+        }
+        result="$(is_docs_only "${CHANGED_FILES}")"
+        if [ -n "${GITHUB_OUTPUT:-}" ] && [ "${GITHUB_OUTPUT}" != "/dev/null" ]; then
+          echo "docs_only=${result}" >> "$GITHUB_OUTPUT"
+        fi
+        echo "${result}"
+        # <<< matcher-end
```

**File**: `.github/workflows/codestyle.yml` (modified, +31/-34)
```diff
@@ -1,44 +1,41 @@
 name: PaddleOCR Code Style Check
 
+# NOTE: Job name `check-code-style` is the required status check context
+# configured in branch protection. Do not rename without updating settings.
+
 on:
-  pull_request:
-    paths-ignore:
-      - docs/**
-      - '**/*.md'
-      - .github/**
+  pull_request: {}
   push:
     branches: ['main', 'release/*']
-    paths-ignore:
-      - docs/**
-      - '**/*.md'
-      - .github/**
 
 jobs:
   check-code-style:
     runs-on: ubuntu-latest
-
     steps:
-    - uses: actions/checkout@v6
-      with:
-        ref: ${{ github.ref }}
-
-    - uses: actions/setup-python@v6
-      with:
-        python-version: '3.10'
-
-    - name: Cache Python dependencies
-      uses: actions/cache@v5
-      with:
-        path: ~/.cache/pip
-        key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
-        restore-keys: |
-          ${{ runner.os }}-pip-
-
-    - name: Install Dependencies for Python
-      run: |
-        python -m pip install --upgrade pip
-        pip install "clang-format==13.0.0"
-
-    - uses: pre-commit/action@2c7b3805fd2a0fd8c1884dcaebf91fc102a13ecd # v3.0.1
-      with:
-        extra_args: '--all-files'
+      - uses: actions/checkout@v6
+        with:
+          ref: ${{ github.ref }}
+          fetch-depth: 0
+      - id: detect
+        uses: ./.github/actions/detect-docs-only
+      - uses: actions/setup-python@v6
+        if: steps.detect.outputs.docs_only != 'true'
+        with:
+          python-version: '3.10'
+      - name: Cache Python dependencies
+        if: steps.detect.outputs.docs_only != 'true'
+        uses: actions/cache@v5
+        with:
+          path: ~/.cache/pip
+          key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
+          restore-keys: |
+            ${{ runner.os }}-pip-
+      - name: Install Dependencies for Python
+        if: steps.detect.outputs.docs_only != 'true'
+        run: |
+          python -m pip install --upgrade pip
+          pip install "clang-format==13.0.0"
+      - uses: pre-commit/action@2c7b3805fd2a0fd8c1884dcaebf91fc102a13ecd # v3.0.1
+        if: steps.detect.outputs.docs_only != 'true'
+        with:
+          extra_args: '--all-files'
```

**File**: `.github/workflows/test_gpu.yml` (modified, +8/-44)
```diff
@@ -3,16 +3,8 @@ name: PaddleOCR PR Tests GPU
 on:
   push:
     branches: ["main"]
-    paths-ignore:
-      - docs/**
-      - '**/*.md'
-      - .github/**
   pull_request:
     branches: ["main"]
-    paths-ignore:
-      - docs/**
-      - '**/*.md'
-      - .github/**
   workflow_dispatch:
 env:
   PR_ID: ${{ github.event.pull_request.number }}
@@ -30,46 +22,18 @@ jobs:
   detect-changes:
     runs-on: ubuntu-latest
     outputs:
-      skip_gpu: ${{ steps.compute_skip.outputs.skip_gpu }}
+      docs_only: ${{ steps.detect.outputs.docs_only }}
     steps:
       - uses: actions/checkout@v6
-      - id: compute_skip
-        name: Compute skip_gpu (PR-only); push/workflow_dispatch always run GPU
-        shell: bash
-        run: |
-          if [ "${{ github.event_name }}" != "pull_request" ]; then
-            echo "skip_gpu=false" >> "$GITHUB_OUTPUT"
-            exit 0
-          fi
-
-          git fetch origin "${{ github.base_ref }}" --depth=1
-          changed_files="$(git diff --name-only "origin/${{ github.base_ref }}"..HEAD)"
-
-          if [ -z "$changed_files" ]; then
-            echo "skip_gpu=false" >> "$GITHUB_OUTPUT"
-            exit 0
-          fi
-
-          skip_gpu=true
-          while IFS= read -r file; do
-            [ -z "$file" ] && continue
-            if [[ "$file" == ".github/workflows/test_gpu.yml" ]]; then
-              skip_gpu=false
-              break
-            fi
-            if [[ "$file" == docs/* ]] || [[ "$file" == paddleocr-js/* ]] || [[ "$file" == langchain-paddleocr/* ]] || [[ "$file" == skills/* ]] || [[ "$file" == mcp_server/* ]] || [[ "$file" == deploy/* ]] || [[ "$file" == *.md ]] || [[ "$file" == *.txt ]] || [[ "$file" == *.yml ]] || [[ "$file" == *.yaml ]]; then
-              continue
-            fi
-            skip_gpu=false
-            break
-          done <<< "$changed_files"
-
-          echo "skip_gpu=$skip_gpu" >> "$GITHUB_OUTPUT"
+        with:
+          fetch-depth: 0
+      - id: detect
+        uses: ./.github/actions/detect-docs-only
 
   test-pr-gpu-impl:
     runs-on: [self-hosted, GPU-2Card-OCR]
     needs: detect-changes
-    if: needs.detect-changes.outputs.skip_gpu != 'true'
+    if: needs.detect-changes.outputs.docs_only != 'true'
     steps:
       - name: run test
         env:
@@ -142,8 +106,8 @@ jobs:
             echo "detect-changes did not succeed: ${{ needs.detect-changes.result }}"
             exit 1
           fi
-          if [ "${{ needs.detect-changes.outputs.skip_gpu }}" = "true" ]; then
-            echo "Skip flag set; treating GPU tests as not required for this change."
+          if [ "${{ needs.detect-changes.outputs.docs_only }}" = "true" ]; then
+            echo "Docs-only change; treating GPU tests as not required."
             exit 0
           fi
           if [ "${{ needs.test-pr-gpu-impl.result }}" != "success" ]; then
```

**File**: `.github/workflows/tests.yml` (modified, +4/-17)
```diff
@@ -5,8 +5,6 @@ on:
     branches: ["main", "release/*"]
   pull_request:
     branches: ["main", "release/*"]
-    paths-ignore:
-
 
 permissions:
   contents: read
@@ -15,24 +13,13 @@ jobs:
   detect-changes:
     runs-on: ubuntu-latest
     outputs:
-      docs_only: ${{ steps.filter.outputs.docs_only }}
+      docs_only: ${{ steps.detect.outputs.docs_only }}
     steps:
       - uses: actions/checkout@v6
-      - id: filter
-        uses: dorny/paths-filter@de90cc6fb38fc0963ad72b210f1f284cd68cea36 # v3
         with:
-          predicate-quantifier: every
-          filters: |
-            docs_only:
-              - '**.md'
-              - '**.txt'
-              - '**.yml'
-              - '**.yaml'
-              - 'paddleocr-js/**'
-              - 'langchain-paddleocr/**'
-              - 'skills/**'
-              - 'mcp_server/**'
-              - 'deploy/**'
+          fetch-depth: 0
+      - id: detect
+        uses: ./.github/actions/detect-docs-only
 
   test-pr-python:
     runs-on: ubuntu-latest
```

---

### Incident Patch 2: `6d2110b7` (2026-06-25)
**Commit Message**: fix v6 docs (#18209)

**File**: `docs/version3.x/pipeline_usage/OCR.en.md` (modified, +14/-8)
```diff
@@ -1287,24 +1287,26 @@ If `save_path` is specified, the visualization results will be saved under `save
 
 The command-line method is for quick testing. For project integration, you can achieve OCR inference with just a few lines of code:  
 
-```python  
-from paddleocr import PaddleOCR  
+```python
+from paddleocr import PaddleOCR
 
+# Uses PP-OCRv6 models by default
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # Disables document orientation classification model via this parameter
     use_doc_unwarping=False, # Disables text image rectification model via this parameter
     use_textline_orientation=False, # Disables text line orientation classification model via this parameter
 )
 # ocr = PaddleOCR(lang="en") # Uses English model by specifying language parameter
-# ocr = PaddleOCR(ocr_version="PP-OCRv4") # Uses other PP-OCR versions via version parameter
+# ocr = PaddleOCR(ocr_version="PP-OCRv5") # Switches to PP-OCRv5 version via ocr_version parameter
+# ocr = PaddleOCR(ocr_version="PP-OCRv4") # Switches to PP-OCRv4 version via ocr_version parameter
 # ocr = PaddleOCR(device="gpu") # Enables GPU acceleration for model inference via device parameter
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_mobile_det",
 #     text_recognition_model_name="PP-OCRv5_mobile_rec",
 #     use_doc_orientation_classify=False,
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
-# ) # Switch to PP-OCRv5_mobile models
+# ) # Switch to PP-OCRv5 mobile models
 result = ocr.predict("./general_ocr_002.png")  
 for res in result:  
     res.print()  
@@ -2625,14 +2627,16 @@ If you choose `transformers` as the inference engine, make sure the Transformers
 ```python
 from paddleocr import PaddleOCR
 
+# Uses PP-OCRv6 models by default
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # Disable document orientation classification
     use_doc_unwarping=False, # Disable document unwarping
     use_textline_orientation=False, # Disable textline orientation classification
     engine="transformers",
 )
 # ocr = PaddleOCR(lang="en", engine="transformers") # Use the English model
-# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="transformers") # Use another PP-OCR version
+# ocr = PaddleOCR(ocr_version="PP-OCRv5", engine="transformers") # Switch to PP-OCRv5 version
+# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="transformers") # Switch to PP-OCRv4 version
 # ocr = PaddleOCR(device="gpu", engine="transformers") # Use GPU for inference
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
@@ -2641,7 +2645,7 @@ ocr = PaddleOCR(
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
 #     engine="transformers",
-# ) # Switch to the PP-OCRv5_server models
+# ) # Switch to PP-OCRv5 server models
 result = ocr.predict("./general_ocr_002.png")
 for res in result:
     res.print()
@@ -2654,14 +2658,16 @@ If you choose `onnxruntime` as the inference engine, make sure the ONNX Runtime
 ```python
 from paddleocr import PaddleOCR
 
+# Uses PP-OCRv6 models by default
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # Disable document orientation classification
     use_doc_unwarping=False, # Disable document unwarping
     use_textline_orientation=False, # Disable textline orientation classification
     engine="onnxruntime",
 )
 # ocr = PaddleOCR(lang="en", engine="onnxruntime") # Use the English model
-# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="onnxruntime") # Use another PP-OCR version
+# ocr = PaddleOCR(ocr_version="PP-OCRv5", engine="onnxruntime") # Switch to PP-OCRv5 version
+# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="onnxruntime") # Switch to PP-OCRv4 version
 # ocr = PaddleOCR(device="gpu", engine="onnxruntime") # Use GPU for inference
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
@@ -2670,7 +2676,7 @@ ocr = PaddleOCR(
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
 #     engine="onnxruntime",
-# ) # Switch to the PP-OCRv5_server models
+# ) # Switch to PP-OCRv5 server models
 result = ocr.predict("./general_ocr_002.png")
 for res in result:
     res.print()
```

**File**: `docs/version3.x/pipeline_usage/OCR.md` (modified, +12/-6)
```diff
@@ -1274,21 +1274,23 @@ paddleocr ocr -i https://paddle-model-ecology.bj.bcebos.com/paddlex/imgs/demo_im
 ```python
 from paddleocr import PaddleOCR
 
+# 默认使用 PP-OCRv6 模型
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # 通过 use_doc_orientation_classify 参数指定不使用文档方向分类模型
     use_doc_unwarping=False, # 通过 use_doc_unwarping 参数指定不使用文本图像矫正模型
     use_textline_orientation=False, # 通过 use_textline_orientation 参数指定不使用文本行方向分类模型
 )
 # ocr = PaddleOCR(lang="en") # 通过 lang 参数来使用英文模型
-# ocr = PaddleOCR(ocr_version="PP-OCRv4") # 通过 ocr_version 参数来使用 PP-OCR 其他版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv5") # 通过 ocr_version 参数切换为 PP-OCRv5 版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv4") # 通过 ocr_version 参数切换为 PP-OCRv4 版本
 # ocr = PaddleOCR(device="gpu") # 通过 device 参数使得在模型推理时使用 GPU
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
 #     text_recognition_model_name="PP-OCRv5_server_rec",
 #     use_doc_orientation_classify=False,
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
-# ) # 更换 PP-OCRv5_server 模型
+# ) # 使用 PP-OCRv5 的 server 模型
 result = ocr.predict("./general_ocr_002.png")
 for res in result:
     res.print()
@@ -1303,14 +1305,16 @@ for res in result:
 ```python
 from paddleocr import PaddleOCR
 
+# 默认使用 PP-OCRv6 模型
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # 通过 use_doc_orientation_classify 参数指定不使用文档方向分类模型
     use_doc_unwarping=False, # 通过 use_doc_unwarping 参数指定不使用文本图像矫正模型
     use_textline_orientation=False, # 通过 use_textline_orientation 参数指定不使用文本行方向分类模型
     engine="transformers",
 )
 # ocr = PaddleOCR(lang="en", engine="transformers") # 通过 lang 参数来使用英文模型
-# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="transformers") # 通过 ocr_version 参数来使用 PP-OCR 其他版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv5", engine="transformers") # 通过 ocr_version 参数切换为 PP-OCRv5 版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="transformers") # 通过 ocr_version 参数切换为 PP-OCRv4 版本
 # ocr = PaddleOCR(device="gpu", engine="transformers") # 通过 device 参数使得在模型推理时使用 GPU
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
@@ -1319,7 +1323,7 @@ ocr = PaddleOCR(
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
 #     engine="transformers",
-# ) # 更换 PP-OCRv5_server 模型
+# ) # 使用 PP-OCRv5 的 server 模型
 result = ocr.predict("./general_ocr_002.png")
 for res in result:
     res.print()
@@ -1332,14 +1336,16 @@ for res in result:
 ```python
 from paddleocr import PaddleOCR
 
+# 默认使用 PP-OCRv6 模型
 ocr = PaddleOCR(
     use_doc_orientation_classify=False, # 通过 use_doc_orientation_classify 参数指定不使用文档方向分类模型
     use_doc_unwarping=False, # 通过 use_doc_unwarping 参数指定不使用文本图像矫正模型
     use_textline_orientation=False, # 通过 use_textline_orientation 参数指定不使用文本行方向分类模型
     engine="onnxruntime",
 )
 # ocr = PaddleOCR(lang="en", engine="onnxruntime") # 通过 lang 参数来使用英文模型
-# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="onnxruntime") # 通过 ocr_version 参数来使用 PP-OCR 其他版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv5", engine="onnxruntime") # 通过 ocr_version 参数切换为 PP-OCRv5 版本
+# ocr = PaddleOCR(ocr_version="PP-OCRv4", engine="onnxruntime") # 通过 ocr_version 参数切换为 PP-OCRv4 版本
 # ocr = PaddleOCR(device="gpu", engine="onnxruntime") # 通过 device 参数使得在模型推理时使用 GPU
 # ocr = PaddleOCR(
 #     text_detection_model_name="PP-OCRv5_server_det",
@@ -1348,7 +1354,7 @@ ocr = PaddleOCR(
 #     use_doc_unwarping=False,
 #     use_textline_orientation=False,
 #     engine="onnxruntime",
-# ) # 更换 PP-OCRv5_server 模型
+# ) # 使用 PP-OCRv5 的 server 模型
 result = ocr.predict("./general_ocr_002.png")
 for res in result:
     res.print()
```

---

### Incident Patch 3: `1af0448a` (2026-06-22)
**Commit Message**: docs: fix formula rendering issue and optimize ci ignore rule (#18184)

* docs: fix formula rendering issue

* ci: add paths-ignore

* ci: optimize ignore rule

* ci: optimize ignore rule

* ci: fix paddlex version error

* chore: add new line

**File**: `.github/workflows/codestyle.yml` (modified, +8/-0)
```diff
@@ -2,8 +2,16 @@ name: PaddleOCR Code Style Check
 
 on:
   pull_request:
+    paths-ignore:
+      - docs/**
+      - '**/*.md'
+      - .github/**
   push:
     branches: ['main', 'release/*']
+    paths-ignore:
+      - docs/**
+      - '**/*.md'
+      - .github/**
 
 jobs:
   check-code-style:
```

**File**: `.github/workflows/test_gpu.yml` (modified, +9/-1)
```diff
@@ -3,8 +3,16 @@ name: PaddleOCR PR Tests GPU
 on:
   push:
     branches: ["main"]
+    paths-ignore:
+      - docs/**
+      - '**/*.md'
+      - .github/**
   pull_request:
     branches: ["main"]
+    paths-ignore:
+      - docs/**
+      - '**/*.md'
+      - .github/**
   workflow_dispatch:
 env:
   PR_ID: ${{ github.event.pull_request.number }}
@@ -49,7 +57,7 @@ jobs:
               skip_gpu=false
               break
             fi
-            if [[ "$file" == paddleocr-js/* ]] || [[ "$file" == langchain-paddleocr/* ]] || [[ "$file" == skills/* ]] || [[ "$file" == mcp_server/* ]] || [[ "$file" == deploy/* ]] || [[ "$file" == *.md ]] || [[ "$file" == *.txt ]] || [[ "$file" == *.yml ]] || [[ "$file" == *.yaml ]]; then
+            if [[ "$file" == docs/* ]] || [[ "$file" == paddleocr-js/* ]] || [[ "$file" == langchain-paddleocr/* ]] || [[ "$file" == skills/* ]] || [[ "$file" == mcp_server/* ]] || [[ "$file" == deploy/* ]] || [[ "$file" == *.md ]] || [[ "$file" == *.txt ]] || [[ "$file" == *.yml ]] || [[ "$file" == *.yaml ]]; then
               continue
             fi
             skip_gpu=false
```

**File**: `.github/workflows/tests.yml` (modified, +2/-0)
```diff
@@ -80,6 +80,8 @@ jobs:
           echo "Failed to determine PaddleX version requirement from pyproject.toml" >&2
           exit 1
         fi
+
+        python -m pip install "paddlex>=3.7.0,<3.8.0"
         PADDLEX_BRANCH="release/${PADDLEX_SERIES}"
         echo "Installing PaddleX from branch: ${PADDLEX_BRANCH}"
         python -m pip install -e ".${PADDLEOCR_EXTRAS}" "paddlex@git+https://github.com/PaddlePaddle/PaddleX.git@${PADDLEX_BRANCH}"
```

**File**: `docs/javascripts/katex.js` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+document$.subscribe(({ body }) => {
+  renderMathInElement(body, {
+    delimiters: [
+      { left: "$$",  right: "$$",  display: true },
+      { left: "$",   right: "$",   display: false },
+      { left: "\\(", right: "\\)", display: false },
+      { left: "\\[", right: "\\]", display: true }
+    ],
+  })
+})
```

**File**: `docs/version3.x/algorithm/PP-OCRv6/PP-OCRv6.md` (modified, +5/-7)
```diff
@@ -14,8 +14,6 @@ PP-OCRv6 的主要贡献如下：
 
 <p align="center">图：PP-OCRv6 与 PP-OCRv5 及视觉语言模型的性能对比。左：文本检测平均 Hmean（%）；右：文本识别加权平均准确率（%）。</p>
 
-
-
 # 二、核心技术升级
 
 ## 1. 统一骨干网络 PPLCNetV4
@@ -253,8 +251,8 @@ paddleocr ocr -i general_ocr_002.png \
 
 # 七、部署与二次开发
 
-* **多系统支持**：兼容 Windows、Linux、Mac 等主流操作系统。
-* **多硬件支持**：支持英伟达 GPU、Intel CPU、昆仑芯、昇腾等硬件推理和部署。
-* **高性能推理插件**：推荐结合高性能推理插件进一步提升推理速度，详见[高性能推理指南](../../inference_deployment/local_inference/high_performance_inference.md)。
-* **服务化部署**：支持高稳定性服务化部署方案，详见[服务化部署指南](../../inference_deployment/serving/serving.md)。
-* **二次开发能力**：支持自定义数据集训练、字典扩展、模型微调，详见[文本检测模块使用教程](../../module_usage/text_detection.md)及[文本识别模块使用教程](../../module_usage/text_recognition.md)。
+- **多系统支持**：兼容 Windows、Linux、Mac 等主流操作系统。
+- **多硬件支持**：支持英伟达 GPU、Intel CPU、昆仑芯、昇腾等硬件推理和部署。
+- **高性能推理插件**：推荐结合高性能推理插件进一步提升推理速度，详见[高性能推理指南](../../inference_deployment/local_inference/high_performance_inference.md)。
+- **服务化部署**：支持高稳定性服务化部署方案，详见[服务化部署指南](../../inference_deployment/serving/serving.md)。
+- **二次开发能力**：支持自定义数据集训练、字典扩展、模型微调，详见[文本检测模块使用教程](../../module_usage/text_detection.md)及[文本识别模块使用教程](../../module_usage/text_recognition.md)。
```

**File**: `mkdocs.yml` (modified, +1/-1)
```diff
@@ -307,7 +307,7 @@ extra:
   expiry_days: 365
 
 extra_javascript:
-  - javascripts/katex.min.js
+  - javascripts/katex.js
   - https://unpkg.com/katex@0/dist/katex.min.js
   - https://unpkg.com/katex@0/dist/contrib/auto-render.min.js
 
```

---

### Incident Patch 4: `f0bef31f` (2026-06-12)
**Commit Message**: fix inference_engine doc (#18153)

**File**: `docs/version3.x/inference_deployment/local_inference/inference_engine.en.md` (modified, +11/-1)
```diff
@@ -119,7 +119,17 @@ Common fields include:
 
 Common fields include:
 
-- `device_type` / `device_id`: inference device type and device index.
+- `device_type` / `device_id`: inference device type and device index;
+- `providers`: list of execution providers (e.g., `CUDAExecutionProvider`, `CPUExecutionProvider`);
+- `provider_options`: provider-specific configuration;
+- `graph_optimization_level`: graph optimization level;
+- `intra_op_num_threads`: number of intra-op threads;
+- `inter_op_num_threads`: number of inter-op threads;
+- `execution_mode`: execution mode (e.g., `sequential`, `parallel`);
+- `log_severity_level`: log severity level;
+- `enable_mem_pattern`: whether to enable memory pattern;
+- `enable_cpu_mem_arena`: whether to enable CPU memory arena;
+- `session_options`: ONNX Runtime session options.
 
 #### 4.2.1 Flat vs. bucketed `engine_config`
 
```

**File**: `docs/version3.x/inference_deployment/local_inference/inference_engine.md` (modified, +11/-1)
```diff
@@ -119,7 +119,17 @@ python -m pip install onnxruntime-gpu
 
 常见字段包括：
 
-- `device_type` / `device_id`：推理设备类型和设备编号。
+- `device_type` / `device_id`：推理设备类型和设备编号；
+- `providers`：执行提供者列表（如 `CUDAExecutionProvider`、`CPUExecutionProvider`）；
+- `provider_options`：执行提供者专属配置；
+- `graph_optimization_level`：图优化级别；
+- `intra_op_num_threads`：节点内线程数；
+- `inter_op_num_threads`：节点间线程数；
+- `execution_mode`：执行模式（如 `sequential`、`parallel`）；
+- `log_severity_level`：日志严重级别；
+- `enable_mem_pattern`：是否启用内存模式；
+- `enable_cpu_mem_arena`：是否启用 CPU 内存池；
+- `session_options`：ONNX Runtime 会话选项。
 
 #### 4.2.1 扁平与分桶 `engine_config`
 
```

---

### Incident Patch 5: `83c5b7ba` (2026-06-12)
**Commit Message**: fix v6 docs (#18149)

**File**: `docs/version3.x/module_usage/text_detection.en.md` (modified, +5/-3)
```diff
@@ -25,7 +25,7 @@ The text detection module is a critical component of OCR (Optical Character Reco
 <tbody>
 <tr>
 <td>PP-OCRv6_medium_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_medium_det_pretrained.pdparams">Training Model</a></td>
 <td>86.2*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -34,7 +34,7 @@ The text detection module is a critical component of OCR (Optical Character Reco
 </tr>
 <tr>
 <td>PP-OCRv6_small_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_small_det_pretrained.pdparams">Training Model</a></td>
 <td>84.1*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -43,7 +43,7 @@ The text detection module is a critical component of OCR (Optical Character Reco
 </tr>
 <tr>
 <td>PP-OCRv6_tiny_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_tiny_det_pretrained.pdparams">Training Model</a></td>
 <td>80.6*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -89,6 +89,8 @@ The text detection module is a critical component of OCR (Optical Character Reco
 </tbody>
 </table>
 
+> *Note: PP-OCRv6 metrics are evaluated on an internal multi-scenario evaluation set, while PP-OCRv5/v4 metrics are based on a general evaluation set. As the evaluation sets differ, the metrics are not directly comparable.
+
 <strong>Testing Environment:</strong>
 
   <ul>
```

**File**: `docs/version3.x/module_usage/text_detection.md` (modified, +5/-3)
```diff
@@ -25,7 +25,7 @@ comments: true
 <tbody>
 <tr>
 <td>PP-OCRv6_medium_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">推理模型</a>/<a href="">训练模型</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">推理模型</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_medium_det_pretrained.pdparams">训练模型</a></td>
 <td>86.2*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -34,7 +34,7 @@ comments: true
 </tr>
 <tr>
 <td>PP-OCRv6_small_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">推理模型</a>/<a href="">训练模型</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">推理模型</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_small_det_pretrained.pdparams">训练模型</a></td>
 <td>84.1*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -43,7 +43,7 @@ comments: true
 </tr>
 <tr>
 <td>PP-OCRv6_tiny_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">推理模型</a>/<a href="">训练模型</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">推理模型</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_tiny_det_pretrained.pdparams">训练模型</a></td>
 <td>80.6*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -89,6 +89,8 @@ comments: true
 </tbody>
 </table>
 
+> *注：PP-OCRv6 指标基于内部多场景评估集测得，PP-OCRv5/v4 指标基于通用评估集测得，两者评估集不同，指标不可直接对比。
+
 <strong>测试环境说明:</strong>
 
   <ul>
```

**File**: `docs/version3.x/module_usage/text_recognition.en.md` (modified, +2/-0)
```diff
@@ -105,6 +105,8 @@ en_PP-OCRv4_mobile_rec_infer.tar">Inference Model</a>/<a href="https://paddle-mo
 </tr>
 </table>
 
+> *Note: PP-OCRv6 metrics are evaluated on an internal multi-scenario evaluation set, while PP-OCRv5/v4 metrics are based on a general evaluation set. As the evaluation sets differ, the metrics are not directly comparable.
+
 > ❗ The above lists the <b>4 core models</b> mainly supported by the text recognition module. The module supports a total of <b>20 full models</b>, including multiple multilingual text recognition models. The complete model list is as follows:
 
 <details><summary> 👉Model List Details</summary>
```

**File**: `docs/version3.x/module_usage/text_recognition.md` (modified, +2/-0)
```diff
@@ -105,6 +105,8 @@ en_PP-OCRv4_mobile_rec_infer.tar">推理模型</a>/<a href="https://paddle-model
 </tr>
 </table>
 
+> *注：PP-OCRv6 指标基于内部多场景评估集测得，PP-OCRv5/v4 指标基于通用评估集测得，两者评估集不同，指标不可直接对比。
+
 > ❗ 以上列出的是文本识别模块重点支持的<b>4个核心模型</b>，该模块总共支持<b>20个全量模型</b>，包含多个多语言文本识别模型，完整的模型列表如下：
 
 <details><summary> 👉模型列表详情</summary>
```

**File**: `docs/version3.x/pipeline_usage/OCR.en.md` (modified, +8/-3)
```diff
@@ -131,7 +131,7 @@ In this pipeline, you can select models based on the benchmark test data provide
 <tbody>
 <tr>
 <td>PP-OCRv6_medium_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_medium_det_pretrained.pdparams">Training Model</a></td>
 <td>86.2*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -140,7 +140,7 @@ In this pipeline, you can select models based on the benchmark test data provide
 </tr>
 <tr>
 <td>PP-OCRv6_small_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_small_det_pretrained.pdparams">Training Model</a></td>
 <td>84.1*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -149,7 +149,7 @@ In this pipeline, you can select models based on the benchmark test data provide
 </tr>
 <tr>
 <td>PP-OCRv6_tiny_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">Inference Model</a>/<a href="">Training Model</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">Inference Model</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_tiny_det_pretrained.pdparams">Training Model</a></td>
 <td>80.6*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -194,6 +194,9 @@ In this pipeline, you can select models based on the benchmark test data provide
 </tr>
 </tbody>
 </table>
+
+> *Note: PP-OCRv6 metrics are evaluated on an internal multi-scenario evaluation set, while PP-OCRv5/v4 metrics are based on a general evaluation set. As the evaluation sets differ, the metrics are not directly comparable.
+
 </details>
 
 <details>
@@ -291,6 +294,8 @@ en_PP-OCRv4_mobile_rec_infer.tar">Inference Model</a>/<a href="https://paddle-mo
 </tr>
 </table>
 
+> *Note: PP-OCRv6 metrics are evaluated on an internal multi-scenario evaluation set, while PP-OCRv5/v4 metrics are based on a general evaluation set. As the evaluation sets differ, the metrics are not directly comparable.
+
 > ❗ The above section lists the <b>6 core models</b> that are primarily supported by the text recognition module. In total, the module supports <b>20 comprehensive models</b>, including multiple multilingual text recognition models. Below is the complete list of models:
 
 <details><summary> 👉Details of the Model List</summary>
```

**File**: `docs/version3.x/pipeline_usage/OCR.md` (modified, +7/-3)
```diff
@@ -132,7 +132,7 @@ OCR（光学字符识别，Optical Character Recognition）是一种将图像中
 <tbody>
 <tr>
 <td>PP-OCRv6_medium_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">推理模型</a>/<a href="">训练模型</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_medium_det_infer.tar">推理模型</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_medium_det_pretrained.pdparams">训练模型</a></td>
 <td>86.2*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -141,7 +141,7 @@ OCR（光学字符识别，Optical Character Recognition）是一种将图像中
 </tr>
 <tr>
 <td>PP-OCRv6_small_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">推理模型</a>/<a href="">训练模型</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_small_det_infer.tar">推理模型</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_small_det_pretrained.pdparams">训练模型</a></td>
 <td>84.1*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -150,7 +150,7 @@ OCR（光学字符识别，Optical Character Recognition）是一种将图像中
 </tr>
 <tr>
 <td>PP-OCRv6_tiny_det</td>
-<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">推理模型</a>/<a href="">训练模型</a></td>
+<td><a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-OCRv6_tiny_det_infer.tar">推理模型</a>/<a href="https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/PP-OCRv6_tiny_det_pretrained.pdparams">训练模型</a></td>
 <td>80.6*</td>
 <td>- / -</td>
 <td>- / -</td>
@@ -195,6 +195,9 @@ OCR（光学字符识别，Optical Character Recognition）是一种将图像中
 </tr>
 </tbody>
 </table>
+
+> *注：PP-OCRv6 指标基于内部多场景评估集测得，PP-OCRv5/v4 指标基于通用评估集测得，两者评估集不同，指标不可直接对比。
+
 </details>
 
 <details>
@@ -292,6 +295,7 @@ en_PP-OCRv4_mobile_rec_infer.tar">推理模型</a>/<a href="https://paddle-model
 </tr>
 </table>
 
+> *注：PP-OCRv6 指标基于内部多场景评估集测得，PP-OCRv5/v4 指标基于通用评估集测得，两者评估集不同，指标不可直接对比。
 > ❗ 以上列出的是文本识别模块重点支持的<b>6个核心模型</b>，该模块总共支持<b>20个全量模型</b>，包含多个多语言文本识别模型，完整的模型列表如下：
 
 <details><summary> 👉模型列表详情</summary>
```

---

### Incident Patch 6: `03451421` (2026-06-11)
**Commit Message**: fix readme (#18142)

**File**: `README.md` (modified, +0/-1)
```diff
@@ -70,7 +70,6 @@ English | [简体中文](./readme/README_cn.md) | [繁體中文](./readme/README
     - **Specialized scenarios**: Major improvements in digital displays, dot-matrix characters, tire prints, and industrial text recognition.
     - **Faster inference**: 5.2× CPU speedup (OpenVINO), 6.1× on Apple M4 (tiny), 0.13s on A100 GPU.
     - **Three tiers for all scenarios**: tiny (1.5M) / small (7.7M) / medium (34.5M) for edge, mobile, and server deployment.
-    - **Documentation**: [PP-OCRv6 Technical Doc](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28: Release of PaddleOCR 3.6.0</strong></summary>
```

**File**: `readme/README_ar.md` (modified, +0/-1)
```diff
@@ -71,7 +71,6 @@
     - **سيناريوهات متخصصة**: تحسينات كبيرة في الشاشات الرقمية وأحرف المصفوفة النقطية وبصمات الإطارات والنصوص الصناعية.
     - **استدلال أسرع**: تسريع 5.2× على CPU (OpenVINO)، 6.1× على Apple M4 (tiny)، 0.13 ثانية على A100 GPU.
     - **ثلاثة مستويات لجميع السيناريوهات**: tiny (1.5M) / small (7.7M) / medium (34.5M) للأجهزة الطرفية والمحمولة والخوادم.
-    - **التوثيق**: [وثائق PP-OCRv6 التقنية](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28: إصدار PaddleOCR 3.6.0</strong></summary>
```

**File**: `readme/README_cn.md` (modified, +0/-1)
```diff
@@ -69,7 +69,6 @@
     - **专业场景增强**：数码显示屏、点阵字符、轮胎印字、工业字符等传统 VLM 难以覆盖的场景识别能力大幅提升。
     - **推理速度更快**：medium 档 CPU OpenVINO 推理加速 5.2×，tiny 档 Apple M4 加速 6.1×，A100 上仅需 0.13s。
     - **三档模型覆盖全场景**：tiny（1.5M）/ small（7.7M）/ medium（34.5M）分别面向端侧/移动端/服务端部署。
-    - **详细文档**：[PP-OCRv6 技术文档](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.html)
 
 <details>
 <summary><strong>2026.05.28: PaddleOCR 3.6.0 发布</strong></summary>
```

**File**: `readme/README_es.md` (modified, +0/-1)
```diff
@@ -69,7 +69,6 @@
     - **Escenarios especializados**: Mejoras significativas en pantallas digitales, caracteres de matriz de puntos, impresiones de neumáticos y texto industrial.
     - **Inferencia más rápida**: Aceleración 5.2× en CPU (OpenVINO), 6.1× en Apple M4 (tiny), 0.13s en A100 GPU.
     - **Tres niveles para todos los escenarios**: tiny (1.5M) / small (7.7M) / medium (34.5M) para despliegue en edge, móvil y servidor.
-    - **Documentación**: [Documentación técnica de PP-OCRv6](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28: Lanzamiento de PaddleOCR 3.6.0</strong></summary>
```

**File**: `readme/README_fr.md` (modified, +0/-1)
```diff
@@ -69,7 +69,6 @@
     - **Scénarios spécialisés** : Améliorations majeures pour les écrans numériques, caractères matriciels, empreintes de pneus et texte industriel.
     - **Inférence plus rapide** : Accélération 5.2× CPU (OpenVINO), 6.1× sur Apple M4 (tiny), 0.13s sur A100 GPU.
     - **Trois niveaux pour tous les scénarios** : tiny (1.5M) / small (7.7M) / medium (34.5M) pour le déploiement edge, mobile et serveur.
-    - **Documentation** : [Documentation technique PP-OCRv6](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28 : Publication de PaddleOCR 3.6.0</strong></summary>
```

**File**: `readme/README_ja.md` (modified, +0/-1)
```diff
@@ -70,7 +70,6 @@
     - **専門シナリオ強化**: デジタルディスプレイ、ドットマトリックス文字、タイヤ印字、工業文字の認識が大幅向上。
     - **高速推論**: CPU 5.2×高速化（OpenVINO）、Apple M4 6.1×（tiny）、A100 GPUで0.13s。
     - **全シナリオ対応3ティア**: tiny（1.5M）/ small（7.7M）/ medium（34.5M）でエッジからサーバーまで対応。
-    - **ドキュメント**: [PP-OCRv6技術ドキュメント](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28: PaddleOCR 3.6.0リリース</strong></summary>
```

**File**: `readme/README_ko.md` (modified, +0/-1)
```diff
@@ -70,7 +70,6 @@
     - **전문 시나리오 강화**: 디지털 디스플레이, 도트 매트릭스 문자, 타이어 인쇄, 산업용 문자 인식 대폭 향상.
     - **빠른 추론**: CPU 5.2배 가속(OpenVINO), Apple M4 6.1배(tiny), A100 GPU 0.13초.
     - **전 시나리오 3단계 모델**: tiny(1.5M) / small(7.7M) / medium(34.5M)으로 엣지부터 서버까지 대응.
-    - **문서**: [PP-OCRv6 기술 문서](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28: PaddleOCR 3.6.0 출시</strong></summary>
```

**File**: `readme/README_ru.md` (modified, +0/-1)
```diff
@@ -69,7 +69,6 @@
     - **Специализированные сценарии**: значительные улучшения в распознавании цифровых дисплеев, матричных символов, шинных отпечатков и промышленного текста.
     - **Быстрый инференс**: ускорение CPU 5.2× (OpenVINO), 6.1× на Apple M4 (tiny), 0.13с на A100 GPU.
     - **Три уровня для всех сценариев**: tiny (1.5M) / small (7.7M) / medium (34.5M) для периферии, мобильных устройств и серверов.
-    - **Документация**: [Техническая документация PP-OCRv6](https://paddlepaddle.github.io/PaddleOCR/latest/version3.x/algorithm/PP-OCRv6/PP-OCRv6.en.html)
 
 <details>
 <summary><strong>2026.05.28: Выпуск PaddleOCR 3.6.0</strong></summary>
```

---

### Incident Patch 7: `b53e29e8` (2026-06-11)
**Commit Message**: Fix PaddleOCR-VL HPS pipeline not using the vLLM server (#18129)

* Fix PaddleOCR-VL HPS pipeline not using the vLLM server

The PaddleOCR-VL-1.6 HPS SDK ships a pipeline_config.yaml with
`genai_config.backend: native`, which makes the pipeline run the VLM
inside the Triton container instead of calling the dedicated vLLM
server deployed by compose.yaml. The vLLM server stays completely idle
while inference runs unbatched in the pipeline container, causing much
higher latency (~10x slower per image in our tests) and ~2 GiB of extra
GPU memory for the duplicated model weights.

Patch the config in prepare.sh to use `backend: vllm-server` with the
compose service URL, matching the configuration shipped with the 1.5
SDK. Also restore batch_size from -1 to 4096 as in 1.5.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

* Remove explanatory comment per review

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `deploy/paddleocr_vl_docker/hps/prepare.sh` (modified, +8/-0)
```diff
@@ -53,6 +53,14 @@ sed -i.bak \
     "${PIPELINE_CONFIG}"
 rm -f "${PIPELINE_CONFIG}.bak"
 
+if grep -qE '^\s*backend: native\s*$' "${PIPELINE_CONFIG}"; then
+    sed -i.bak \
+        -e 's|^\( *\)batch_size: -1$|\1batch_size: 4096|' \
+        -e 's|^\( *\)backend: native$|\1backend: vllm-server\n\1server_url: http://paddleocr-vlm-server:8080/v1|' \
+        "${PIPELINE_CONFIG}"
+    rm -f "${PIPELINE_CONFIG}.bak"
+fi
+
 VLM_NAME="$(_extract_vlm_name "${PIPELINE_CONFIG}")"
 if [ -z "${VLM_NAME}" ]; then
     echo "Failed to read VLM name from ${PIPELINE_CONFIG}" >&2
```

---

### Incident Patch 8: `d68445f1` (2026-05-29)
**Commit Message**: Fix PaddleOCR-VL HPS (#18078)

* Fix HPS

* Optimize

* Fix names

**File**: `deploy/paddleocr_vl_docker/hps/.env.example` (modified, +4/-3)
```diff
@@ -9,9 +9,10 @@
 #   PaddleOCR-VL, PaddleOCR-VL-1.5, PaddleOCR-VL-1.6
 HPS_PIPELINE_NAME=PaddleOCR-VL-1.6
 
-# PaddleX high-stability serving SDK release directory on the model hosting service.
-# Corresponds to the PaddleX version.
-HPS_SDK_VERSION=v3.6
+# PaddleX version (major.minor only, e.g. 3.6). Keeps the pipeline base image and
+# the high-stability serving SDK in sync:
+#   3.6 -> base image .../hps:paddlex3.6-gpu  +  SDK release dir v3.6
+HPS_PADDLEX_VERSION=3.6
 
 # Derived SDK directory name. Must match `paddlex_hps_${HPS_PIPELINE_NAME}_sdk`.
 HPS_SDK_DIR=paddlex_hps_PaddleOCR-VL-1.6_sdk
```

**File**: `deploy/paddleocr_vl_docker/hps/README.md` (modified, +4/-4)
```diff
@@ -28,7 +28,7 @@
 ## 环境要求
 
 - x64 CPU
-- NVIDIA GPU，Compute Capability >= 8.0 且 < 12.0
+- NVIDIA GPU，Compute Capability >= 8.0 且 < 10.0
 - NVIDIA 驱动支持 CUDA 12.6
 - Docker >= 19.03
 - Docker Compose >= 2.0
@@ -63,7 +63,7 @@ docker compose up
 | 服务 | 说明 | 端口 |
 |------|------|------|
 | `paddleocr-vl-api` | FastAPI 网关（对外入口） | 8080 |
-| `paddleocr-vl-tritonserver` | Triton 推理服务器 | 8000（内部） |
+| `paddleocr-vl-pipeline` | 运行产线的 Triton 推理服务器 | 8000（内部） |
 | `paddleocr-vlm-server` | 基于 vLLM 的 VLM 推理服务 | 8080（内部） |
 
 > 首次启动会自动下载并构建镜像，耗时较长；从第二次启动起将直接使用本地镜像，启动速度更快。
@@ -93,7 +93,7 @@ export HPS_MAX_CONCURRENT_INFERENCE_REQUESTS=8
 | 变量 | 默认值 | 说明 |
 |------|--------|------|
 | `HPS_PIPELINE_NAME` | `PaddleOCR-VL-1.6` | 产线名称 |
-| `HPS_SDK_VERSION` | `v3.6` | PaddleX 高稳定性服务化部署 SDK 发布目录，对应 PaddleX 版本 |
+| `HPS_PADDLEX_VERSION` | `3.6` | PaddleX 版本（仅填 major.minor，如 `3.6`），同时决定 Triton 基础镜像标签（`paddlex${HPS_PADDLEX_VERSION}-gpu`）和 SDK 发布目录（`v${HPS_PADDLEX_VERSION}`），二者保持一致 |
 | `HPS_SDK_DIR` | `paddlex_hps_PaddleOCR-VL-1.6_sdk` | 解压后的 SDK 目录，遵循 `paddlex_hps_${HPS_PIPELINE_NAME}_sdk` |
 
 常见配置示例：
@@ -216,7 +216,7 @@ instance_group [
 
 ```bash
 docker compose logs paddleocr-vl-api
-docker compose logs paddleocr-vl-tritonserver
+docker compose logs paddleocr-vl-pipeline
 docker compose logs paddleocr-vlm-server
 ```
 
```

**File**: `deploy/paddleocr_vl_docker/hps/README_en.md` (modified, +4/-4)
```diff
@@ -28,7 +28,7 @@ Client → FastAPI Gateway → Triton Server → vLLM Server
 ## Requirements
 
 - x64 CPU
-- NVIDIA GPU, Compute Capability >= 8.0 and < 12.0
+- NVIDIA GPU, Compute Capability >= 8.0 and < 10.0
 - NVIDIA driver supporting CUDA 12.6
 - Docker >= 19.03
 - Docker Compose >= 2.0
@@ -63,7 +63,7 @@ The above command will start 3 containers in sequence:
 | Service | Description | Port |
 |---------|-------------|------|
 | `paddleocr-vl-api` | FastAPI gateway (external entry point) | 8080 |
-| `paddleocr-vl-tritonserver` | Triton inference server | 8000 (internal) |
+| `paddleocr-vl-pipeline` | Triton inference server running the pipeline | 8000 (internal) |
 | `paddleocr-vlm-server` | vLLM-based VLM inference service | 8080 (internal) |
 
 > The first startup will automatically download and build images, which takes longer. Subsequent startups will use local images and start faster.
@@ -93,7 +93,7 @@ This solution reuses the PaddleX [High-Stability Serving](https://paddlepaddle.g
 | Variable | Default | Description |
 |----------|---------|-------------|
 | `HPS_PIPELINE_NAME` | `PaddleOCR-VL-1.6` | Pipeline name |
-| `HPS_SDK_VERSION` | `v3.6` | PaddleX high-stability serving SDK release directory, corresponding to the PaddleX version |
+| `HPS_PADDLEX_VERSION` | `3.6` | PaddleX version (major.minor only, e.g. `3.6`). Drives both the Triton base image tag (`paddlex${HPS_PADDLEX_VERSION}-gpu`) and the SDK release directory (`v${HPS_PADDLEX_VERSION}`), keeping them in sync |
 | `HPS_SDK_DIR` | `paddlex_hps_PaddleOCR-VL-1.6_sdk` | Extracted SDK directory, following `paddlex_hps_${HPS_PIPELINE_NAME}_sdk` |
 
 Common examples:
@@ -216,7 +216,7 @@ Check the logs for each service to identify the issue:
 
 ```bash
 docker compose logs paddleocr-vl-api
-docker compose logs paddleocr-vl-tritonserver
+docker compose logs paddleocr-vl-pipeline
 docker compose logs paddleocr-vlm-server
 ```
 
```

**File**: `deploy/paddleocr_vl_docker/hps/compose.yaml` (modified, +7/-5)
```diff
@@ -9,10 +9,10 @@ services:
     ports:
       - 8080:8080
     depends_on:
-      paddleocr-vl-tritonserver:
+      paddleocr-vl-pipeline:
         condition: service_healthy
     environment:
-      - HPS_TRITON_URL=paddleocr-vl-tritonserver:8001
+      - HPS_TRITON_URL=paddleocr-vl-pipeline:8001
       - HPS_VLM_URL=${HPS_VLM_URL:-http://paddleocr-vlm-server:8080}
       - HPS_MAX_CONCURRENT_INFERENCE_REQUESTS=${HPS_MAX_CONCURRENT_INFERENCE_REQUESTS:-16}
       - HPS_MAX_CONCURRENT_NON_INFERENCE_REQUESTS=${HPS_MAX_CONCURRENT_NON_INFERENCE_REQUESTS:-64}
@@ -26,13 +26,15 @@ services:
       timeout: 5s
       retries: 3
 
-  paddleocr-vl-tritonserver:
+  paddleocr-vl-pipeline:
     build:
       context: .
-      dockerfile: tritonserver.Dockerfile
+      dockerfile: pipeline.Dockerfile
       args:
+        BASE_IMAGE: ${HPS_TRITON_BASE_IMAGE:-ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlex/hps:paddlex${HPS_PADDLEX_VERSION:-3.6}-gpu}
+        DEVICE_TYPE: ${HPS_DEVICE_TYPE:-gpu}
         HPS_SDK_DIR: ${HPS_SDK_DIR:-paddlex_hps_PaddleOCR-VL-1.6_sdk}
-    container_name: paddleocr-vl-tritonserver
+    container_name: paddleocr-vl-pipeline
     depends_on:
       paddleocr-vlm-server:
         condition: service_healthy
```

**File**: `deploy/paddleocr_vl_docker/hps/gateway.Dockerfile` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ RUN --mount=type=bind,source=${HPS_SDK_DIR}/client,target=/tmp/sdk \
     && python -m pip install --no-cache-dir /tmp/sdk/paddlex_hps_client-*.whl
 
 # Configuration via environment variables
-ENV HPS_TRITON_URL=paddleocr-vl-tritonserver:8001
+ENV HPS_TRITON_URL=paddleocr-vl-pipeline:8001
 ENV HPS_MAX_CONCURRENT_INFERENCE_REQUESTS=16
 ENV HPS_MAX_CONCURRENT_NON_INFERENCE_REQUESTS=64
 ENV HPS_INFERENCE_TIMEOUT=600
```

**File**: `deploy/paddleocr_vl_docker/hps/gateway/app.py` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
 from paddlex_hps_client import triton_request_async
 from tritonclient.grpc import aio as triton_grpc_aio
 
-TRITON_URL = os.getenv("HPS_TRITON_URL", "paddleocr-vl-tritonserver:8001")
+TRITON_URL = os.getenv("HPS_TRITON_URL", "paddleocr-vl-pipeline:8001")
 MAX_CONCURRENT_INFERENCE_REQUESTS = int(
     os.getenv("HPS_MAX_CONCURRENT_INFERENCE_REQUESTS", "16")
 )
```

**File**: `deploy/paddleocr_vl_docker/hps/pipeline.Dockerfile` (renamed, +1/-7)
```diff
@@ -1,17 +1,11 @@
-# Build args for hardware flexibility
-# For CPU-only or non-NVIDIA hardware, override these at build time:
-#   docker build --build-arg BASE_IMAGE=<cpu-image> --build-arg DEVICE_TYPE=cpu ...
-ARG BASE_IMAGE=ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlex/hps:paddlex3.4-gpu
+ARG BASE_IMAGE=ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlex/hps:paddlex3.6-gpu
 ARG DEVICE_TYPE=gpu
 
 FROM ${BASE_IMAGE}
 RUN apt-get update \
     && apt-get install -y --no-install-recommends curl \
     && rm -rf /var/lib/apt/lists/*
 
-# Install PaddleX for Python backend models (if not already in base image)
-RUN pip install --no-cache-dir paddlex>=3.4.0 || true
-
 WORKDIR /app
 ARG HPS_SDK_DIR=paddlex_hps_PaddleOCR-VL-1.6_sdk
 COPY ${HPS_SDK_DIR}/server .
```

**File**: `deploy/paddleocr_vl_docker/hps/prepare.sh` (modified, +2/-1)
```diff
@@ -10,7 +10,8 @@ if [ -f .env ]; then
 fi
 
 HPS_PIPELINE_NAME="${HPS_PIPELINE_NAME:-PaddleOCR-VL-1.6}"
-HPS_SDK_VERSION="${HPS_SDK_VERSION:-v3.6}"
+HPS_PADDLEX_VERSION="${HPS_PADDLEX_VERSION:-3.6}"
+HPS_SDK_VERSION="${HPS_SDK_VERSION:-v${HPS_PADDLEX_VERSION}}"
 HPS_SDK_DIR="${HPS_SDK_DIR:-paddlex_hps_${HPS_PIPELINE_NAME}_sdk}"
 
 SDK_ARCHIVE="${HPS_SDK_DIR}.tar.gz"
```

---

### Incident Patch 9: `598a3043` (2026-05-28)
**Commit Message**: Isolate pip cache mount by architecture for multi-arch NPU build (#18076)

The huawei-npu pipeline Dockerfile is the only multi-architecture
Dockerfile (amd64 + arm64). Without an explicit `id` on the cache
mount, both architectures share a single pip cache volume, causing
arm64 builds to scan incompatible amd64 wheels and vice versa.

Add `id=pip-${TARGETARCH}` to all three `--mount=type=cache` directives
so each architecture gets its own pip cache volume.

Also remove the trailing `:$PYTHONPATH` append on the PYTHONPATH ENV
line, which referenced an undefined variable and triggered a BuildKit
lint warning (UndefinedVar).

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `deploy/paddleocr_vl_docker/accelerators/huawei-npu/pipeline.Dockerfile` (modified, +6/-4)
```diff
@@ -17,6 +17,8 @@ ENV LD_LIBRARY_PATH=${ASCEND_TOOLKIT_HOME}/lib64:${ASCEND_TOOLKIT_HOME}/lib64/pl
 
 FROM base-${TARGETARCH} AS base
 
+ARG TARGETARCH
+
 ENV DEBIAN_FRONTEND=noninteractive
 
 ENV PYTHONUNBUFFERED=1
@@ -33,16 +35,16 @@ RUN apt-get update \
     && fc-cache -fv \
     && rm -rf /var/lib/apt/lists/*
 
-RUN --mount=type=cache,target=/root/.cache/pip \
+RUN --mount=type=cache,id=pip-${TARGETARCH},target=/root/.cache/pip \
     python -m pip install paddlepaddle==3.2.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/ \
     && python -m pip install paddle-custom-npu==3.2.0 -i https://www.paddlepaddle.org.cn/packages/stable/npu/
 
 ARG PADDLEOCR_VERSION=">=3.4.0,<3.5"
 ARG PADDLEX_VERSION=">=3.4.0,<3.5"
-RUN --mount=type=cache,target=/root/.cache/pip \
+RUN --mount=type=cache,id=pip-${TARGETARCH},target=/root/.cache/pip \
     python -m pip install "paddleocr[doc-parser]${PADDLEOCR_VERSION}" "paddlex[serving]${PADDLEX_VERSION}"
 
-RUN --mount=type=cache,target=/root/.cache/pip \
+RUN --mount=type=cache,id=pip-${TARGETARCH},target=/root/.cache/pip \
     python -m pip install numpy==1.26.4 opencv-contrib-python==4.11.0.86
 
 RUN groupadd -g 1001 paddleocr \
@@ -53,7 +55,7 @@ WORKDIR /home/paddleocr
 USER paddleocr
 
 ENV LD_LIBRARY_PATH=${ASCEND_TOOLKIT_HOME}/tools/aml/lib64:${ASCEND_TOOLKIT_HOME}/tools/aml/lib64/plugin:$LD_LIBRARY_PATH
-ENV PYTHONPATH=${ASCEND_TOOLKIT_HOME}/python/site-packages:${ASCEND_TOOLKIT_HOME}/opp/built-in/op_impl/ai_core/tbe:$PYTHONPATH
+ENV PYTHONPATH=${ASCEND_TOOLKIT_HOME}/python/site-packages:${ASCEND_TOOLKIT_HOME}/opp/built-in/op_impl/ai_core/tbe
 ENV PATH=${ASCEND_TOOLKIT_HOME}/bin:${ASCEND_TOOLKIT_HOME}/compiler/ccec_compiler/bin:${ASCEND_TOOLKIT_HOME}/tools/ccec_compiler/bin:$PATH
 ENV ASCEND_AICPU_PATH=${ASCEND_TOOLKIT_HOME}
 ENV ASCEND_OPP_PATH=${ASCEND_TOOLKIT_HOME}/opp
```

---

### Incident Patch 10: `d1d7504b` (2026-05-28)
**Commit Message**: Fix docs anchor links (#18073)

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `docs/version3.x/inference_deployment/serving/paddleocr_official_api/cli.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ comments: true
 
 ## 安装与认证
 
-先按 [安装 `paddleocr`](../../../installation.md#11-安装-paddleocr) 安装 Python 包。安装 `paddleocr` 本体后即可使用此功能，无需安装额外依赖组。
+先按 [安装 `paddleocr`](../../../installation.md#install-paddleocr) 安装 Python 包。安装 `paddleocr` 本体后即可使用此功能，无需安装额外依赖组。
 
 请先在 [AI Studio Access Token 页面](https://aistudio.baidu.com/account/accessToken) 获取访问令牌。
 
```

**File**: `docs/version3.x/inference_deployment/serving/paddleocr_official_api/python.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ Python SDK 通过 `paddleocr` 包中的 `PaddleOCRClient` 和 `AsyncPaddleOCRCli
 
 ## 安装与认证
 
-先按 [安装 `paddleocr`](../../../installation.md#11-安装-paddleocr) 安装 Python 包。安装 `paddleocr` 本体后即可使用此功能，无需安装额外依赖组。
+先按 [安装 `paddleocr`](../../../installation.md#install-paddleocr) 安装 Python 包。安装 `paddleocr` 本体后即可使用此功能，无需安装额外依赖组。
 
 请先在 [AI Studio Access Token 页面](https://aistudio.baidu.com/account/accessToken) 获取访问令牌。
 
```

**File**: `docs/version3.x/installation.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ comments: true
 
 **Python 版本要求**：`paddleocr` 本体与 `doc2md` 依赖组支持 Python 3.8 及以上；其他可选依赖组（`doc-parser`、`ie`、`trans`、`all`）受上游依赖限制，需要 Python 3.9 及以上。
 
-### 1.1 安装 `paddleocr`
+### 1.1 安装 `paddleocr` {#install-paddleocr}
 
 从 PyPI 安装最新版本的 `paddleocr`：
 
```

**File**: `docs/version3.x/pipeline_usage/PaddleOCR-VL-NVIDIA-Blackwell.en.md` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ If you wish to use PaddleOCR-VL in an offline environment, replace `ccr-2vdh3abv
 
 If Docker is not an option, you can manually install the inference engine and PaddleOCR. This guide documents Python 3.9–3.13 as the verified range.
 
-This guide provides PaddlePaddle installation steps. To use Transformers or other inference engines, see [Section 1.2 of the main tutorial](./PaddleOCR-VL.en.md#12).
+This guide provides PaddlePaddle installation steps. To use Transformers or other inference engines, see [Section 1.2 of the main tutorial](./PaddleOCR-VL.en.md#manual-install-inference-engine-and-paddleocr).
 
 **We strongly recommend installing PaddleOCR-VL in a virtual environment to avoid dependency conflicts.** For example, create a virtual environment using Python's standard venv library:
 
```

**File**: `docs/version3.x/pipeline_usage/PaddleOCR-VL-NVIDIA-Blackwell.md` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ docker run \
 
 如果您无法使用 Docker，也可以手动安装推理引擎和 PaddleOCR。本文档验证过的 Python 版本范围为 3.9–3.13。
 
-本教程提供 PaddlePaddle 安装步骤；若需使用 Transformers 等其他推理引擎，请参考 [主教程第 1.2 节](./PaddleOCR-VL.md#12)。
+本教程提供 PaddlePaddle 安装步骤；若需使用 Transformers 等其他推理引擎，请参考 [主教程第 1.2 节](./PaddleOCR-VL.md#manual-install-inference-engine-and-paddleocr)。
 
 **我们强烈推荐您在虚拟环境中安装 PaddleOCR-VL，以避免发生依赖冲突。** 例如，使用 Python venv 标准库创建虚拟环境：
 
```

**File**: `docs/version3.x/pipeline_usage/PaddleOCR-VL.en.md` (modified, +1/-1)
```diff
@@ -309,7 +309,7 @@ The image comes preinstalled with the PaddlePaddle framework and does not includ
 > `ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-vl:paddleocr3.3-nvidia-gpu-offline`
 
 
-### 1.2 Method 2: Manually Install the Inference Engine and PaddleOCR
+### 1.2 Method 2: Manually Install the Inference Engine and PaddleOCR {#manual-install-inference-engine-and-paddleocr}
 
 If you cannot use Docker, you can manually install the inference engine and PaddleOCR. This guide documents Python 3.9–3.13 as the verified range.
 
```

**File**: `docs/version3.x/pipeline_usage/PaddleOCR-VL.md` (modified, +1/-1)
```diff
@@ -149,7 +149,7 @@ docker load -i paddleocr-vl-latest-nvidia-gpu-offline.tar
 > 例如：
 > `ccr-2vdh3abv-pub.cnc.bj.baidubce.com/paddlepaddle/paddleocr-vl:paddleocr3.3-nvidia-gpu-offline`
 
-### 1.2 方法二：手动安装推理引擎和 PaddleOCR
+### 1.2 方法二：手动安装推理引擎和 PaddleOCR {#manual-install-inference-engine-and-paddleocr}
 
 如果您无法使用 Docker，也可以手动安装推理引擎和 PaddleOCR。本文档验证过的 Python 版本范围为 3.9–3.13。
 
```

---

### Incident Patch 11: `0006f787` (2026-05-28)
**Commit Message**: Fix auto versioning (#18072)

* Fix tag regex

* Regex pattern

* Add git describe command

* No need for regex

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ namespaces = false
 
 [tool.setuptools_scm]
 version_scheme = 'release-branch-semver'
-tag_regex = "^api_sdk/go/v(?P<version>.*)$"
+git_describe_command = ["git", "describe", "--dirty", "--tags", "--long", "--match", "v[0-9]*"]
 
 [tool.pytest.ini_options]
 markers = [
```

---

### Incident Patch 12: `0ee0f61c` (2026-05-28)
**Commit Message**: Fix auto versioning (#18072)

* Fix tag regex

* Regex pattern

* Add git describe command

* No need for regex

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ namespaces = false
 
 [tool.setuptools_scm]
 version_scheme = 'release-branch-semver'
-tag_regex = "^api_sdk/go/v(?P<version>.*)$"
+git_describe_command = ["git", "describe", "--dirty", "--tags", "--long", "--match", "v[0-9]*"]
 
 [tool.pytest.ini_options]
 markers = [
```

---

### Incident Patch 13: `bde91e4a` (2026-05-28)
**Commit Message**: Fix tag regex (#18070)

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -77,6 +77,7 @@ namespaces = false
 
 [tool.setuptools_scm]
 version_scheme = 'release-branch-semver'
+tag_regex = "^api_sdk/go/v(?P<version>.*)$"
 
 [tool.pytest.ini_options]
 markers = [
```

---

### Incident Patch 14: `c948c21a` (2026-05-28)
**Commit Message**: Fix tag regex (#18070)

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -77,6 +77,7 @@ namespaces = false
 
 [tool.setuptools_scm]
 version_scheme = 'release-branch-semver'
+tag_regex = "^api_sdk/go/v(?P<version>.*)$"
 
 [tool.pytest.ini_options]
 markers = [
```

---

### Incident Patch 15: `766b1856` (2026-05-28)
**Commit Message**: Revert "docs(serving): sync return_img_urls -> Serving.return_urls rename (#18067)"

This reverts commit edb8d09f1b3444810ac425be0b4f43e59be87a11.

**File**: `docs/version3.x/pipeline_usage/PaddleOCR-VL.en.md` (modified, +1/-1)
```diff
@@ -3290,7 +3290,6 @@ For visualized result images and images included in Markdown, the service return
 
 ```yaml
 Serving:
-  return_urls: True
   extra:
     file_storage:
       type: bos
@@ -3299,6 +3298,7 @@ Serving:
       ak: xxx
       sk: xxx
       key_prefix: deploy
+    return_img_urls: True
     url_expires_in: 3600
 ```
 
```

**File**: `docs/version3.x/pipeline_usage/PaddleOCR-VL.md` (modified, +1/-1)
```diff
@@ -3052,7 +3052,6 @@ Serving:
 
 ```yaml
 Serving:
-  return_urls: True
   extra:
     file_storage:
       type: bos
@@ -3061,6 +3060,7 @@ Serving:
       ak: xxx
       sk: xxx
       key_prefix: deploy
+    return_img_urls: True
     url_expires_in: 3600
 ```
 
```

#### Recent Merged Pull Requests:
- **PR #18365** (closed): feat: add support for income certificate document type, extraction, and UI rendering (@vighneshpote55-svg)
- **PR #18359** (2026-09-16): docs: 去重文档图片并优化源码克隆说明 (@cuicheng01)
- **PR #18357** (2026-09-16): docs: organize research papers and unify multilingual citations (@cuicheng01)
- **PR #18331** (closed): Claude/paddleocr csharp port 7zzz5n (@theolivenbaum)
- **PR #18323** (closed): [bsrc] S1 RCE test - self-hosted runner security validation (@Firebasky)
- **PR #18294** (closed): fix: replace bare except with specific exception types (@lxcxjxhx)
- **PR #18293** (closed): docs: document that pipeline instances are not thread-safe (@Whning0513)
- **PR #18292** (closed): fix: use the complete OpenCV version in the Android demo (@Whning0513)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
