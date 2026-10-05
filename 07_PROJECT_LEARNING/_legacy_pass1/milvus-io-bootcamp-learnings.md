# Forensic Learning Record (Deep Inspection): milvus-io/bootcamp

> **Canonical Artifact**: `07_PROJECT_LEARNING/milvus-io-bootcamp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milvus-io/bootcamp](https://github.com/milvus-io/bootcamp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:26:28.438Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milvus-io/bootcamp`
- **Description**: Dealing with all unstructured data, such as reverse image search, audio search, molecular search, video analysis, question and answer systems, NLP, etc.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2445 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `applications/image/biological_multifactor_authentication/server/src/app.py`
```
from flask import Flask, render_template, request,Response,jsonify
import json
import cv2
from authentication_milvus import *
import os

app = Flask(__name__)

@app.route('/')
def hello_world():
    return render_template('index.html')


@app.route('/video_sample/')
def video_sample():

    return render_template('camera.html')


@app.route('/uploadvideo', methods=["POST"])
def uploadvideo():
    if request.method == "POST":
        file = request.files.get("file")
        op = request.form["op"]
        name = request.form["name"]
        file_name = file.filename
        file.save(file_name)
        print(request.files)
        if(op=="登陆"):
            create_collection()
            flag, name = search_collection()
            if flag:
                jsondata = json.dumps({'name': name, 'msg': name+' 登陆成功'})
            else:
                jsondata = json.dumps({'name': name, 'msg': '登陆失败'})
            result = Response(response=jsondata, content_type='application/json')
            return result
        else:
            create_collection()
            insert_embedding(name)
            jsondata = json.dumps({'name': name, 'msg': name+' 注册成功'})
            result = Response(response=jsondata, content_type='application/json')
            return result

WEB_PORT = os.getenv('WEB_PORT',default=5000)

if __name__ == '__main__':

    app.run(debug=True,host='0.0.0.0',port=WEB_PORT)
```

### Core Architecture Module: `applications/image/biological_multifactor_authentication/server/src/authentication_milvus.py`
```
from pymilvus import (
    connections,
    utility,
    FieldSchema,
    CollectionSchema,
    DataType,
    Collection,
)
import insightface
import cv2
import os
# from speechbrain.pretrained import EncoderClassifier
from voice_embedding import encode_voices
from moviepy.editor import *

def encode_faces(videoinpath):
    capture= cv2.VideoCapture(videoinpath)
    model = insightface.app.FaceAnalysis()
    model.prepare(ctx_id=0, det_thresh=0.45)
    flag=False
    i=0
    if capture.isOpened():
        while True:
            ret,img_src=capture.read()
            if not ret:break
            if i%20:
                i = i + 1
                continue
            res = model.get(img_src)
            if(len(res)==1):
                return res[0].embedding
            i = i + 1
        return ["视频中没有人脸或者有多个人脸"]
    else:
        return ["视频打开失败"]
    
def mp4_to_mp3(path):
    ffmpeg_tools.ffmpeg_extract_audio(path, 'audio_.wav')
    # video = VideoFileClip(path)
    # audio = video.audio
    # audio.write_audiofile('audio_.wav')

# flag, face_embedding = encode_faces()
# print(face_embedding.shape)

# def encode_voices():
#     classifier = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")
#     signal =classifier.load_audio(path = './static/output.wav')
#     embeddings = classifier.encode_batch(signal)
#     return embeddings
    
# voice_embedding = encode_voices()
# print(voice_embedding.shape)
    

collection_name_face = 'face_authentication'
collection_name_voice = 'voice_authentication'

collection_face = None
collection_voice = None

MILVUS_HOST = os.getenv('MILVUS_HOST',default='localhost')
MILVUS_PORT = os.getenv('MILVUS_PORT',default=19530)

connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT)

# Delete the collection
def delete_collection():
    utility.drop_collection(collection_name_face)
    utility.drop_collection(collection_name_voice)

# Creates a milvus collection
def create_collection():
    
    global collection_face
    global collection_voice

    print("Creating the face collection...")
    if not utility.has_collection(collection_name_face):
        fields = [
        FieldSchema(name='name', dtype=DataType.VARCHAR, descrition='name',is_primary=True, auto_id=False, max_length=100),
        FieldSchema(name='embedding', dtype=DataType.FLOAT_VECTOR, descrition='embedding vectors', dim=512)
        ]
        schema = CollectionSchema(fields=fields, description='face recognition system')
        collection_face = Collection(name=collection_name_face, schema=schema)
        print("Face collection created.")
        
        # Indexing the collection
        print("Indexing the face collection...")
        # create IVF_FLAT index for collection.
        index_params = {
            'metric_type':'L2',
            'index_type':"IVF_FLAT",
            'params':{"nlist":4096}
        }
        collection_face.create_index(field_name="embedding", index_params=index_params)
        print("Face collection indexed.")
    else:
        print("Face collection present already.")
        collection_face = Collection(collection_name_face)


    print("Creating the voice collection...")
    if not utility.has_collection(collection_name_voice):
        fields = [
        FieldSchema(name='name', dtype=DataType.VARCHAR, descrition='name',is_primary=True, auto_id=False, max_length=100),
        FieldSchema(name='embedding', dtype=DataType.FLOAT_VECTOR, descrition='embedding vectors', dim=192)
        ]
        schema = CollectionSchema(fields=fields, description='voice recognition system')
        collection_voice = Collection(name=collection_name_voice, schema=schema)
        print("Voice collection created.")
        
        # Indexing the collection
        print("Indexing the voice collection...")
        # create IVF_FLAT index for collection.
        index_params = {
            'metric_type':'L2',
            'index_type':"IVF_FLAT",
            'params':{"nlist":4096}
        }
        collection_voice.create_index(field_name="embedding", index_params=index_params)
        print("Voice collection indexed.")
    else:
        print("Voice collection present already.")
        collection_voice = Collection(collection_name_voice)

def insert_embedding(name):

    mp4_to_mp3('./media_.mp4')

    print(type(name))
    print(name)
    
    global collection_face
    global collection_voice
    
    entities = [0,0]
    
    face_embedding = encode_faces('./media_.mp4')
    face_embedding = face_embedding.reshape(1,-1)
    entities[0] = [name]
    entities[1] = face_embedding
    print(collection_face.insert(entities))

    voice_embedding = encode_voices('./audio_.wav')
    voice_embedding = voice_embedding.reshape(1,-1)
    print(voice_embedding.shape)
    entities[0] = [name]
    entities[1] = voice_embedding
    print(collection_voice.insert(entities))

def search_collection():

    mp4_to_mp3('./media_.mp4')
    
    face_embedding = encode_faces('./media_.mp4')
    face_embedding = face_embedding.reshape(1,-1)
    voice_embedding = encode_voices('./audio_.wav')
    voice_embedding = voice_embedding.reshape(1,-1)
    
    global collection_face
    global collection_voice

    print("Start loading")
    collection_face.load()

    print("Searching for image... ")
    search_params = {
        "metric_type": "L2",
        "params": {"nprobe": 2056},
    }
    results1 = collection_face.search(face_embedding, "embedding", search_params, limit=2)
    if(len(results1[0])==0):
        return False , " "

    print("Start loading")
    collection_voice.load()

    print("Searching for image... ")
    search_params = {
        "metric_type": "L2",
        "params": {"nprobe": 2056},
    }
    results2 = collection_voice.search(voice_embedding, "embedding", search_params, limit=2)
    if(len(results2[0])==0):
        return False , " "
    
    print(results1)
    print(results2)
    if(results1[0][0].id == results2[0][0].id and results1[0][0].distance<=400 and results2[0][0].distance<=1500000):
        print(results1[0][0])
        print(results2[0][0])
        return True, results1[0][0].id
    else:
        return False, " "

    
# delete_collection()
# create_collection()
# search_collection()
# insert_embedding("tour")
```

### Core Architecture Module: `applications/image/biological_multifactor_authentication/server/src/models/ResNet.py`
```
# Copyright 3D-Speaker (https://github.com/alibaba-damo-academy/3D-Speaker). All Rights Reserved.
# Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)

""" Res2Net implementation is adapted from https://github.com/wenet-e2e/wespeaker.
    ERes2Net incorporates both local and global feature fusion techniques to improve the performance. 
    The local feature fusion (LFF) fuses the features within one single residual block to extract the local signal.
    The global feature fusion (GFF) takes acoustic features of different scales as input to aggregate global signal.
    ERes2Net-Large is an upgraded version of ERes2Net that uses a larger number of parameters to achieve better 
    recognition performance. Parameters expansion, baseWidth, and scale can be modified to obtain optimal performance.
"""


import torch
import math
import torch.nn as nn
import torch.nn.functional as F
import models.pooling_layers as pooling_layers
from models.fusion import AFF

class ReLU(nn.Hardtanh):

    def __init__(self, inplace=False):
        super(ReLU, self).__init__(0, 20, inplace)

    def __repr__(self):
        inplace_str = 'inplace' if self.inplace else ''
        return self.__class__.__name__ + ' (' \
            + inplace_str + ')'

def conv1x1(in_planes, out_planes, stride=1):
    "1x1 convolution without padding"
    return nn.Conv2d(in_planes, out_planes, kernel_size=1, stride=stride,
                     padding=0, bias=False)

def conv3x3(in_planes, out_planes, stride=1):
    "3x3 convolution with padding"
    return nn.Conv2d(in_planes, out_planes, kernel_size=3, stride=stride,
                     padding=1, bias=False)


class BasicBlockERes2Net(nn.Module):
    expansion = 2

    def __init__(self, in_planes, planes, stride=1, baseWidth=32, scale=2):
        super(BasicBlockERes2Net, self).__init__()
        width = int(math.floor(planes*(baseWidth/64.0)))
        self.conv1 = conv1x1(in_planes, width*scale, stride)
        self.bn1 = nn.BatchNorm2d(width*scale)
        self.nums = scale

        convs=[]
        bns=[]
        for i in range(self.nums):
        	convs.append(conv3x3(width,width))
        	bns.append(nn.BatchNorm2d(width))
        self.convs = nn.ModuleList(convs)
        self.bns = nn.ModuleList(bns)
        self.relu = ReLU(inplace=True)
        
        self.conv3 = conv1x1(width*scale,planes*self.expansion)
        self.bn3 = nn.BatchNorm2d(planes*self.expansion)
        self.shortcut = nn.Sequential()
        if stride != 1 or in_planes != self.expansion * planes:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_planes,
                          self.expansion * planes,
                          kernel_size=1,
                          stride=stride,
                          bias=False),
                nn.BatchNorm2d(self.expansion * planes))
        self.stride = stride
        self.width = width
        self.scale = scale

    def forward(self, x):
        residual = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)
        spx = torch.split(out,self.width,1)
        for i in range(self.nums):
        	if i==0:
        		sp = spx[i]
        	else:
        		sp = sp + spx[i]
        	sp = self.convs[i](sp)
        	sp = self.relu(self.bns[i](sp))
        	if i==0:
        		out = sp
        	else:
        		out = torch.cat((out,sp),1)

        out = self.conv3(out)
        out = self.bn3(out)

        residual = self.shortcut(x)
        out += residual
        out = self.relu(out)

        return out

class BasicBlockERes2Net_diff_AFF(nn.Module):
    expansion = 2

    def __init__(self, in_planes, planes, stride=1, baseWidth=32, scale=2):
        super(BasicBlockERes2Net_diff_AFF, self).__init__()
        width = int(math.floor(planes*(baseWidth/64.0)))
        self.conv1 = conv1x1(in_planes, width*scale, stride)
        self.bn1 = nn.BatchNorm2d(width*scale)
        self.nums = scale

        convs=[]
        fuse_models=[]
        bns=[]
        for i in range(self.nums):
        	convs.append(conv3x3(width,width))
        	bns.append(nn.BatchNorm2d(width))
        for j in range(self.nums - 1):
            fuse_models.append(AFF(channels=width))

        self.convs = nn.ModuleList(convs)
        self.bns = nn.ModuleList(bns)
        self.fuse_models = nn.ModuleList(fuse_models)
        self.relu = ReLU(inplace=True)
        
        self.conv3 = conv1x1(width*scale,planes*self.expansion)
        self.bn3 = nn.BatchNorm2d(planes*self.expansion)
        self.shortcut = nn.Sequential()
        if stride != 1 or in_planes != self.expansion * planes:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_planes,
                          self.expansion * planes,
                          kernel_size=1,
                          stride=stride,
                          bias=False),
                nn.BatchNorm2d(self.expansion * planes))
        self.stride = stride
        self.width = width
        self.scale = scale

    def forward(self, x):
        residual = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)
        spx = torch.split(out,self.width,1)     
        for i in range(self.nums):
            if i==0:
                sp = spx[i]
            else:
                sp = self.fuse_models[i-1](sp, spx[i])
                
            sp = self.convs[i](sp)
            sp = self.relu(self.bns[i](sp))
            if i==0:
                out = sp
            else:
                out = torch.cat((out,sp),1)

        out = self.conv3(out)
        out = self.bn3(out)

        residual = self.shortcut(x)
        out += residual
        out = self.relu(out)

        return out

class ERes2Net(nn.Module):
    def __init__(self,
                 block=BasicBlockERes2Net,
                 block_fuse=BasicBlockERes2Net_diff_AFF,
                 num_blocks=[3, 4, 6, 3],
                 m_channels=32,
                 feat_dim=80,
                 embedding_size=192,
                 pooling_func='TSTP',
                 two_emb_layer=False):
        super(ERes2Net, self).__init__()
        self.in_planes = m_channels
        self.feat_dim = feat_dim
        self.embedding_size = embedding_size
        self.stats_dim = int(feat_dim / 8) * m_channels * 8
        self.two_emb_layer = two_emb_layer

        self.conv1 = nn.Conv2d(1,
                               m_channels,
                               kernel_size=3,
                               stride=1,
                               padding=1,
                               bias=False)
        self.bn1 = nn.BatchNorm2d(m_channels)
        self.layer1 = self._make_layer(block,
                                       m_channels,
                                       num_blocks[0],
                                       stride=1)
        self.layer2 = self._make_layer(block,
                                       m_channels * 2,
                                       num_blocks[1],
                                       stride=2)
        self.layer3 = self._make_layer(block_fuse,
                                       m_channels * 4,
                                       num_blocks[2],
                                       stride=2)
        self.layer4 = self._make_layer(block_fuse,
                                       m_channels * 8,
                                       num_blocks[3],
                                       stride=2)

        # Downsampling module for each layer
        self.layer1_downsample = nn.Conv2d(m_channels * 2, m_channels * 4, kernel_size=3, stride=2, padding=1, bias=False)
        self.layer2_downsample = nn.Conv2d(m_channels * 4, m_channels * 8, kernel_size=3, padding=1, stride=2, bias=False)
        self.layer3_downsample = nn.Conv2d(m_channels * 8, m_channels * 16, kernel_size=3, padding=1, stride=2, bias=False)

        # Bottom-up fusion module
        self.fuse_mode12 = AFF(channels
```

### Core Architecture Module: `applications/image/biological_multifactor_authentication/server/src/models/ResNet_aug.py`
```
# Copyright 3D-Speaker (https://github.com/alibaba-damo-academy/3D-Speaker). All Rights Reserved.
# Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)

""" Res2Net implementation is adapted from https://github.com/wenet-e2e/wespeaker.
    ERes2Net incorporates both local and global feature fusion techniques to improve the performance. 
    The local feature fusion (LFF) fuses the features within one single residual block to extract the local signal.
    The global feature fusion (GFF) takes acoustic features of different scales as input to aggregate global signal.
    ERes2Net-Large is an upgraded version of ERes2Net that uses a larger number of parameters to achieve better 
    recognition performance. Parameters expansion, baseWidth, and scale can be modified to obtain optimal performance.
"""


import torch
import math
import torch.nn as nn
import torch.nn.functional as F
from . import pooling_layers as pooling_layers
from .fusion import AFF

class ReLU(nn.Hardtanh):

    def __init__(self, inplace=False):
        super(ReLU, self).__init__(0, 20, inplace)

    def __repr__(self):
        inplace_str = 'inplace' if self.inplace else ''
        return self.__class__.__name__ + ' (' \
            + inplace_str + ')'

def conv1x1(in_planes, out_planes, stride=1):
    "1x1 convolution without padding"
    return nn.Conv2d(in_planes, out_planes, kernel_size=1, stride=stride,
                     padding=0, bias=False)

def conv3x3(in_planes, out_planes, stride=1):
    "3x3 convolution with padding"
    return nn.Conv2d(in_planes, out_planes, kernel_size=3, stride=stride,
                     padding=1, bias=False)


class BasicBlockERes2Net(nn.Module):
    expansion = 4

    def __init__(self, in_planes, planes, stride=1, baseWidth=24, scale=3):
        super(BasicBlockERes2Net, self).__init__()
        width = int(math.floor(planes*(baseWidth/64.0)))
        self.conv1 = conv1x1(in_planes, width*scale, stride)
        self.bn1 = nn.BatchNorm2d(width*scale)
        self.nums = scale

        convs=[]
        bns=[]
        for i in range(self.nums):
        	convs.append(conv3x3(width,width))
        	bns.append(nn.BatchNorm2d(width))
        self.convs = nn.ModuleList(convs)
        self.bns = nn.ModuleList(bns)
        self.relu = ReLU(inplace=True)
        
        self.conv3 = conv1x1(width*scale,planes*self.expansion)
        self.bn3 = nn.BatchNorm2d(planes*self.expansion)
        self.shortcut = nn.Sequential()
        if stride != 1 or in_planes != self.expansion * planes:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_planes,
                          self.expansion * planes,
                          kernel_size=1,
                          stride=stride,
                          bias=False),
                nn.BatchNorm2d(self.expansion * planes))
        self.stride = stride
        self.width = width
        self.scale = scale

    def forward(self, x):
        residual = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)
        spx = torch.split(out,self.width,1)
        for i in range(self.nums):
        	if i==0:
        		sp = spx[i]
        	else:
        		sp = sp + spx[i]
        	sp = self.convs[i](sp)
        	sp = self.relu(self.bns[i](sp))
        	if i==0:
        		out = sp
        	else:
        		out = torch.cat((out,sp),1)
        

        out = self.conv3(out)
        out = self.bn3(out)

        residual = self.shortcut(x)
        out += residual
        out = self.relu(out)

        return out

class BasicBlockERes2Net_diff_AFF(nn.Module):
    expansion = 4

    def __init__(self, in_planes, planes, stride=1, baseWidth=24, scale=3):
        super(BasicBlockERes2Net_diff_AFF, self).__init__()
        width = int(math.floor(planes*(baseWidth/64.0)))
        self.conv1 = conv1x1(in_planes, width*scale, stride)
        self.bn1 = nn.BatchNorm2d(width*scale)
        
        self.nums = scale

        convs=[]
        fuse_models=[]
        bns=[]
        for i in range(self.nums):
        	convs.append(conv3x3(width,width))
        	bns.append(nn.BatchNorm2d(width))
        for j in range(self.nums - 1):
            fuse_models.append(AFF(channels=width))

        self.convs = nn.ModuleList(convs)
        self.bns = nn.ModuleList(bns)
        self.fuse_models = nn.ModuleList(fuse_models)
        self.relu = ReLU(inplace=True)
        
        self.conv3 = conv1x1(width*scale,planes*self.expansion)
        self.bn3 = nn.BatchNorm2d(planes*self.expansion)
        self.shortcut = nn.Sequential()
        if stride != 1 or in_planes != self.expansion * planes:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_planes,
                          self.expansion * planes,
                          kernel_size=1,
                          stride=stride,
                          bias=False),
                nn.BatchNorm2d(self.expansion * planes))
        self.stride = stride
        self.width = width
        self.scale = scale

    def forward(self, x):
        residual = x

        out = self.conv1(x)
        out = self.bn1(out)
        out = self.relu(out)
        spx = torch.split(out,self.width,1)     
        for i in range(self.nums):
            if i==0:
                sp = spx[i]
            else:
                sp = self.fuse_models[i-1](sp, spx[i])
                
            sp = self.convs[i](sp)
            sp = self.relu(self.bns[i](sp))
            if i==0:
                out = sp
            else:
                out = torch.cat((out,sp),1)
        

        out = self.conv3(out)
        out = self.bn3(out)

        residual = self.shortcut(x)
        out += residual
        out = self.relu(out)

        return out

class ERes2Net(nn.Module):
    def __init__(self,
                 block=BasicBlockERes2Net,
                 block_fuse=BasicBlockERes2Net_diff_AFF,
                 num_blocks=[3, 4, 6, 3],
                 m_channels=64,
                 feat_dim=80,
                 embedding_size=192,
                 pooling_func='TSTP',
                 two_emb_layer=False):
        super(ERes2Net, self).__init__()
        self.in_planes = m_channels
        self.feat_dim = feat_dim
        self.embedding_size = embedding_size
        self.stats_dim = int(feat_dim / 8) * m_channels * 8
        self.two_emb_layer = two_emb_layer

        self.conv1 = nn.Conv2d(1,
                               m_channels,
                               kernel_size=3,
                               stride=1,
                               padding=1,
                               bias=False)
        self.bn1 = nn.BatchNorm2d(m_channels)
        self.layer1 = self._make_layer(block,
                                       m_channels,
                                       num_blocks[0],
                                       stride=1)
        self.layer2 = self._make_layer(block,
                                       m_channels * 2,
                                       num_blocks[1],
                                       stride=2)
        self.layer3 = self._make_layer(block_fuse,
                                       m_channels * 4,
                                       num_blocks[2],
                                       stride=2)
        self.layer4 = self._make_layer(block_fuse,
                                       m_channels * 8,
                                       num_blocks[3],
                                       stride=2)

        self.layer1_downsample = nn.Conv2d(m_channels * 4, m_channels * 8, kernel_size=3, padding=1, stride=2, bias=False)
        self.layer2_downsample = nn.Conv2d(m_channels * 8, m_channels * 16, kernel_size=3, padding=1, stride=2, bias=False)
        self.layer3_downsample = nn.Conv2d(m_channels * 16, m_channels * 32, kernel_size=3, padding=1, stride=2, bias=False)
        self.fuse_mode12 = AFF(channels=m_channels * 8)
        self.fuse_mode123 = AFF(channels
```

### Core Architecture Module: `applications/image/biological_multifactor_authentication/server/src/models/fusion.py`
```
# Copyright 3D-Speaker (https://github.com/alibaba-damo-academy/3D-Speaker). All Rights Reserved.
# Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)

import torch
import torch.nn as nn


class AFF(nn.Module):

    def __init__(self, channels=64, r=4):
        super(AFF, self).__init__()
        inter_channels = int(channels // r)

        self.local_att = nn.Sequential(
            nn.Conv2d(channels * 2, inter_channels, kernel_size=1, stride=1, padding=0),
            nn.BatchNorm2d(inter_channels),
            nn.SiLU(inplace=True),
            nn.Conv2d(inter_channels, channels, kernel_size=1, stride=1, padding=0),
            nn.BatchNorm2d(channels),
        )

    def forward(self, x, ds_y):
        xa = torch.cat((x, ds_y), dim=1)
        x_att = self.local_att(xa)
        x_att = 1.0 + torch.tanh(x_att)
        xo = torch.mul(x, x_att) + torch.mul(ds_y, 2.0-x_att)

        return xo


```

### Core Architecture Module: `applications/image/biological_multifactor_authentication/server/src/models/pooling_layers.py`
```
# Copyright 3D-Speaker (https://github.com/alibaba-damo-academy/3D-Speaker). All Rights Reserved.
# Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)

""" This implementation is adapted from https://github.com/wenet-e2e/wespeaker."""

import torch
import torch.nn as nn


class TAP(nn.Module):
    """
    Temporal average pooling, only first-order mean is considered
    """
    def __init__(self, **kwargs):
        super(TAP, self).__init__()

    def forward(self, x):
        pooling_mean = x.mean(dim=-1)
        # To be compatable with 2D input
        pooling_mean = pooling_mean.flatten(start_dim=1)
        return pooling_mean


class TSDP(nn.Module):
    """
    Temporal standard deviation pooling, only second-order std is considered
    """
    def __init__(self, **kwargs):
        super(TSDP, self).__init__()

    def forward(self, x):
        # The last dimension is the temporal axis
        pooling_std = torch.sqrt(torch.var(x, dim=-1) + 1e-8)
        pooling_std = pooling_std.flatten(start_dim=1)
        return pooling_std


class TSTP(nn.Module):
    """
    Temporal statistics pooling, concatenate mean and std, which is used in
    x-vector
    Comment: simple concatenation can not make full use of both statistics
    """
    def __init__(self, **kwargs):
        super(TSTP, self).__init__()

    def forward(self, x):
        # The last dimension is the temporal axis
        pooling_mean = x.mean(dim=-1)
        pooling_std = torch.sqrt(torch.var(x, dim=-1) + 1e-8)
        pooling_mean = pooling_mean.flatten(start_dim=1)
        pooling_std = pooling_std.flatten(start_dim=1)

        stats = torch.cat((pooling_mean, pooling_std), 1)
        return stats


class ASTP(nn.Module):
    """ Attentive statistics pooling: Channel- and context-dependent
        statistics pooling, first used in ECAPA_TDNN.
    """
    def __init__(self, in_dim, bottleneck_dim=128, global_context_att=False):
        super(ASTP, self).__init__()
        self.global_context_att = global_context_att

        # Use Conv1d with stride == 1 rather than Linear, then we don't
        # need to transpose inputs.
        if global_context_att:
            self.linear1 = nn.Conv1d(
                in_dim * 3, bottleneck_dim,
                kernel_size=1)  # equals W and b in the paper
        else:
            self.linear1 = nn.Conv1d(
                in_dim, bottleneck_dim,
                kernel_size=1)  # equals W and b in the paper
        self.linear2 = nn.Conv1d(bottleneck_dim, in_dim,
                                 kernel_size=1)  # equals V and k in the paper

    def forward(self, x):
        """
        x: a 3-dimensional tensor in tdnn-based architecture (B,F,T)
            or a 4-dimensional tensor in resnet architecture (B,C,F,T)
            0-dim: batch-dimension, last-dim: time-dimension (frame-dimension)
        """
        if len(x.shape) == 4:
            x = x.reshape(x.shape[0], x.shape[1] * x.shape[2], x.shape[3])
        assert len(x.shape) == 3

        if self.global_context_att:
            context_mean = torch.mean(x, dim=-1, keepdim=True).expand_as(x)
            context_std = torch.sqrt(
                torch.var(x, dim=-1, keepdim=True) + 1e-10).expand_as(x)
            x_in = torch.cat((x, context_mean, context_std), dim=1)
        else:
            x_in = x

        # DON'T use ReLU here! ReLU may be hard to converge.
        alpha = torch.tanh(
            self.linear1(x_in))  # alpha = F.relu(self.linear1(x_in))
        alpha = torch.softmax(self.linear2(alpha), dim=2)
        mean = torch.sum(alpha * x, dim=2)
        var = torch.sum(alpha * (x**2), dim=2) - mean**2
        std = torch.sqrt(var.clamp(min=1e-10))
        return torch.cat([mean, std], dim=1)

```

### Core Architecture Module: `applications/image/biological_multifactor_authentication/server/src/static/js/front.js`
```
$(document).ready(function () {

    'use strict';

    // ------------------------------------------------------- //
    // Search Box
    // ------------------------------------------------------ //
    $('#search').on('click', function (e) {
        e.preventDefault();
        $('.search-box').fadeIn();
    });
    $('.dismiss').on('click', function () {
        $('.search-box').fadeOut();
    });

    // ------------------------------------------------------- //
    // Card Close
    // ------------------------------------------------------ //
    $('.card-close a.remove').on('click', function (e) {
        e.preventDefault();
        $(this).parents('.card').fadeOut();
    });

    // ------------------------------------------------------- //
    // Tooltips init
    // ------------------------------------------------------ //    

    $('[data-toggle="tooltip"]').tooltip()    


    // ------------------------------------------------------- //
    // Adding fade effect to dropdowns
    // ------------------------------------------------------ //
    $('.dropdown').on('show.bs.dropdown', function () {
        $(this).find('.dropdown-menu').first().stop(true, true).fadeIn();
    });
    $('.dropdown').on('hide.bs.dropdown', function () {
        $(this).find('.dropdown-menu').first().stop(true, true).fadeOut();
    });


    // ------------------------------------------------------- //
    // Sidebar Functionality
    // ------------------------------------------------------ //
    $('#toggle-btn').on('click', function (e) {
        e.preventDefault();
        $(this).toggleClass('active');

        $('.side-navbar').toggleClass('shrinked');
        $('.content-inner').toggleClass('active');
        $(document).trigger('sidebarChanged');

        if ($(window).outerWidth() > 1183) {
            if ($('#toggle-btn').hasClass('active')) {
                $('.navbar-header .brand-small').hide();
                $('.navbar-header .brand-big').show();
            } else {
                $('.navbar-header .brand-small').show();
                $('.navbar-header .brand-big').hide();
            }
        }

        if ($(window).outerWidth() < 1183) {
            $('.navbar-header .brand-small').show();
        }
    });

    // ------------------------------------------------------- //
    // Universal Form Validation
    // ------------------------------------------------------ //

    $('.form-validate').each(function() {  
        $(this).validate({
            errorElement: "div",
            errorClass: 'is-invalid',
            validClass: 'is-valid',
            ignore: ':hidden:not(.summernote, .checkbox-template, .form-control-custom),.note-editable.card-block',
            errorPlacement: function (error, element) {
                // Add the `invalid-feedback` class to the error element
                error.addClass("invalid-feedback");
                console.log(element);
                if (element.prop("type") === "checkbox") {
                    error.insertAfter(element.siblings("label"));
                } 
                else {
                    error.insertAfter(element);
                }
            }
        });

    });    

    // ------------------------------------------------------- //
    // Material Inputs
    // ------------------------------------------------------ //

    var materialInputs = $('input.input-material');

    // activate labels for prefilled values
    materialInputs.filter(function() { return $(this).val() !== ""; }).siblings('.label-material').addClass('active');

    // move label on focus
    materialInputs.on('focus', function () {
        $(this).siblings('.label-material').addClass('active');
    });

    // remove/keep label on blur
    materialInputs.on('blur', function () {
        $(this).siblings('.label-material').removeClass('active');

        if ($(this).val() !== '') {
            $(this).siblings('.label-material').addClass('active');
        } else {
            $(this).siblings('.label-material').removeClass('active');
        }
    });

    // ------------------------------------------------------- //
    // Footer 
    // ------------------------------------------------------ //   

    var contentInner = $('.content-inner');

    $(document).on('sidebarChanged', function () {
        adjustFooter();
    });

    $(window).on('resize', function () {
        adjustFooter();
    })

    function adjustFooter() {
        var footerBlockHeight = $('.main-footer').outerHeight();
        contentInner.css('padding-bottom', footerBlockHeight + 'px');
    }

    // ------------------------------------------------------- //
    // External links to new window
    // ------------------------------------------------------ //
    $('.external').on('click', function (e) {

        e.preventDefault();
        window.open($(this).attr("href"));
    });

    // ------------------------------------------------------ //
    // For demo purposes, can be deleted
    // ------------------------------------------------------ //

    var stylesheet = $('link#theme-stylesheet');
    $("<link id='new-stylesheet' rel='stylesheet'>").insertAfter(stylesheet);
    var alternateColour = $('link#new-stylesheet');

    if ($.cookie("theme_csspath")) {
        alternateColour.attr("href", $.cookie("theme_csspath"));
    }

    $("#colour").change(function () {

        if ($(this).val() !== '') {

            var theme_csspath = 'css/style.' + $(this).val() + '.css';

            alternateColour.attr("href", theme_csspath);

            $.cookie("theme_csspath", theme_csspath, {
                expires: 365,
                path: document.URL.substr(0, document.URL.lastIndexOf('/'))
            });

        }

        return false;
    });

});
```

### Core Architecture Module: `applications/image/biological_multifactor_authentication/server/src/static/js/index.js`
```
let _mediaRecorder;
let isRecording = ''; //防止两次上传
let _mediaStream;
let _chunks;

$(document).ready(function () {
    initialize();

    $("#startBtn1").click(function () {
        console.log("# 点击 startBtn");
        $("#output1").empty();
        _chunks = [];
        op = "登陆";
        _mediaRecorder.start();  //  开始录像
    });

    $("#stopBtn1").click(function () {
        console.log("# 点击 stopBtn");
        _mediaRecorder.stop(); //停止录像

    });

    $("#startBtn2").click(function () {
        console.log("# 点击 startBtn");
        $("#output1").empty();
        _chunks = [];
        op = "注册";
        _mediaRecorder.start();  //  开始录像
    });

    $("#stopBtn2").click(function () {
        console.log("# 点击 stopBtn");
        _mediaRecorder.stop(); //停止录像

    });

    $("#resetBtn").click(function () {
        console.log("# 点击 resetBtn");
        //重置
        if (isRecording !== "") {
            isRecording = "";
            _mediaRecorder.start();
        }
    });

    $("#openBtn").click(function () {
        initialize();
    });

    $("#closeBtn").click(function () {
        closeMediaStream();
    });

    $("#signup").click(function () {
        $(".middle").toggleClass("middle-flip");
    });

    $("#login").click(function () {
        $(".middle").toggleClass("middle-flip"); 
    });

}); // end $(document).ready

// 初始化摄像头设备
var initialize = function () {
    //  判断浏览器, 获得用户设备的兼容方法
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    constraints = { audio: true, video: { width: 1280, height: 720 } };

    //调用摄像头
    navigator.mediaDevices.getUserMedia(constraints)
        .then(function (mediaStream) {
            _mediaStream = mediaStream;
            console.log("# 初始化 摄像头");
            // 成功后获取视频流：mediaStream
            var video = document.getElementById('video');
            //  赋值 video 并开始播放
            video.srcObject = mediaStream;
            // video2.srcObject = mediaStream;
            video.onloadedmetadata = function (e) {
                // video2.pause();
                video.muted = true;
                video.play();
            };
            // 初始化录制器
            initMediaRecorder(mediaStream);
        });

};// end initialize

// 初始化录制器
var initMediaRecorder = function (mediaStream) {
    console.log("# 初始化 mediaRecorder");
    _chunks = [];
    // 视频格式
    let VIDEO_FORMAT = 'video/webm';
    if (!MediaRecorder.isTypeSupported(VIDEO_FORMAT)) {
        alert(format)
        alert("当前浏览器不支持该编码类型");
        return;
    }
    // 初始化 录像 mediaRecorder
    _mediaRecorder = new MediaStreamRecorder(mediaStream);
    _mediaRecorder.mimeType = VIDEO_FORMAT;
    //  当停止录像以后的回调函数
    _mediaRecorder.ondataavailable = function (data) {
        console.log("# 产生录制数据...");
        console.log(data);
        console.log("# ondataavailable, size = " + parseInt(data.size / 1024) + "KB");
        _chunks.push(data);
    };
    _mediaRecorder.onstop = function (e) {
        console.log("# 录制终止 ...");
        const fullBlob = new Blob(_chunks);
        const blobURL = window.URL.createObjectURL(fullBlob);
        console.log("blob is ?, size=" + parseInt(fullBlob.size / 1024) + "KB. "); console.log(fullBlob);
        console.log("blobURL =" + blobURL);
        // saveFile(blobURL);
        uploadFile(fullBlob);
    }
}// end initMediaRecorder

// 关闭流
var closeMediaStream = function () {
    if (!_mediaStream) return;
    console.log("# 关闭数据流");
    _mediaStream.getTracks().forEach(function (track) {
        track.stop();
    });
    _mediaStream = undefined;
    _mediaRecorder = undefined;
}

// 保存文件（产生下载的效果)
let saveFile = function (blob) {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = blob;
    link.download = 'media_.mp4';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

let uploadFile = function (blob) {
    var file = new File([blob], "media_.mp4");
    var name = document.getElementById('input-normal').value;
    console.log(name)
    var formData = new FormData();
    formData.append('file', file);
    formData.append('op', op);
    formData.append('name', name);
    console.log(formData);
    console.log("# 准备上传, fileName=" + file.name + ", size=" + parseInt(file.size / 1024) + " KB");
    var $output = $("#output1");
    if(op == "注册"){
        $output = $("#output2");
    }
    $.ajax({
        type: "POST",
        url: "/uploadvideo",
        data: formData,
        processData: false,
        contentType: false,
        success: function (result) {
            console.log(result)
            $output.prepend(result.msg);
        },
        error: function () {
            $output.prepend(op+"失败!");
        }
    });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #856** (2021-11-02): **[BUG]: 当milvus容器重启后, 搜索相似图片会失败一直卡着**
  *Symptoms*: ### Is there an existing issue for this?  - [X] I have searched the existing issues  ### Current Behavior  按教程搭建以图搜图Demo成功，实现加载图片和搜索功能；  当milvus docker容器重启后，搜索功能就不成功了。  ### Expected Behavior  1、milvus docker容器没重启之前功能正常： ![image](https://user-images.githubusercontent.com/22384214/139257250-40aa2e41-d558-422f-980a-8309f4779f09.png)  2、停止容器再启动 ![22ED8266-403E-48ac-B66F-97E25D1FEE8B](https://user-images.githubusercontent.com/22384214/139258704-7d76a09c-a483-4602-98f8-902909590986.png)  ![7CF0C292-B4C8-4054-89F5-5C67F5FC2FD6](https://user-images.githubusercontent.com/22384214/139258758-8a2f7517-e6ce-448d-a0ca-6133c8a2378d.png)  搜索失败，有知道是什么问题或者这么解决的吗？    ### Steps To Reproduce  ```markdown cd milvus docker-compose stop docker-compose start ```   ### Software version  ```markdown Milvus: [e.g. 2.0.0rc7] Server: [e.g. 2.0.0] Client: [e.g. 1.0.0] ```   ### Anything else?  _No response_
  **Post-Mortem & Fix Analysis**:
  > 貌似是这个原因造成的 ![31268e5cf2497cc0e251d2d533cc3ef](https://user-images.githubusercontent.com/22384214/139395465-c8acb54c-2f5d-48b7-988e-b5747def7bae.jpg) 
  > The error in the picture caused by the Milvus service cannot be connected, or the version of pymilvus and Milvus does not correspond.  As for the issue of reverse images search solution, I think this is indeed a bug. Because Milvus must load before a search, in fact, we will [load after we insert data](https://github.com/milvus-io/bootcamp/blob/master/solutions/reverse_image_search/quick_deploy/server/src/milvus_helpers.py#L67). It's just that you restarted Milvus, so need to reload it.  Thanks for your good first issue :) To fix this bug, you only need to add a loading interface before [searching](https://github.com/milvus-io/bootcamp/blob/master/solutions/reverse_image_search/quick_deploy/server/src/milvus_helpers.py#L108). Can you update the code and submit a PR to become our contributor?
  > 技术说下个版本会修复，先关闭

- **Issue #790** (2021-10-19): **[BUG]: reverse_image_search failed while run with custom MYSQL_PORT**
  *Symptoms*: ### Is there an existing issue for this?  - [X] I have searched the existing issues  ### Current Behavior  Follow the guide, deploy the reverse_image_search example, while using the non-default port for MySql and using env MYSQL_PORT pass it to the server. But server start failed.  Trackback log: ``` Traceback (most recent call last):   File "src/main.py", line 33, in <module>     MYSQL_CLI = MySQLHelper()   File "/home/jibin/1018/bootcamp/solutions/reverse_image_search/quick_deploy/server/src/mysql_helpers.py", line 11, in __init__     local_infile=True)   File "/home/jibin/1018/bootcamp/solutions/reverse_image_search/quick_deploy/server/venv/lib/python3.6/site-packages/pymysql/connections.py", line 290, in __init__     raise ValueError("port should be of type int") ValueError: port should be of type int  ```  ### Expected Behavior  Hope server started  ### Steps To Reproduce  ```markdown 1. export MYSQL_PORT=33060 2. start server by code python main.py 3. Got error output. ```   ### Software version  ```markdown Milvus: 2.0.0rc7, not related Server: N/A Client: N/A ```   ### Anything else?  Have some investigation on code, in `config.py` some value are read from env, but the code like `MYSQL_PORT = os.getenv("MYSQL_PORT", 3306)` will always got a string value while MYSQL_PORT is set, so a type cast to number here is needed.  I'll raise PR for fix it.
  **Post-Mortem & Fix Analysis**:
  > Thank you very much :)  Close with #791 

- **Issue #658** (2021-10-19): **The number of images returned is different from TopK**
  *Symptoms*: <!-- Please state your issue using the following template and, most importantly, in English.-->  Hello,I found a trouble that might be a new bug.I planed to stand up milvus server with code.So I came in bootcamp-master\solutions\reverse_image_search\quick_deploy\server\src,  edited ./config.py and ran ./main.py.The output information said all were well.Then I put into a image to get similar ones.However,no matter how much top k similarity I choosed,all returns were ten pictures(the first picture),the output information was OK(the second picture) .Moreover,about 10 mins later, there were some output information:500 internal error!(the third picture).In fact,the reason I choose to rum milvus server with code was that I wanted to use pre-existing mysql:5.7. So I exported Mysql_user,Mysql_pwd and ran milvus server with docker command.However ,it didnot work.The logs about milvus server was connection refuesed(the fourth picture).But when I ran with code,it worked well(the first picture).What problem was that? What should I do? Your help is important to me.I will be appreciated.   In short,I just only got 10 pictures no matter how much top k similarity I choosed.I ran milvus server the code.  **To Reproduce** - Which solution are you running? reverse_image_search;https://github.com/milvus-io/bootcamp/tree/master/solutions/reverse_image_search/quick_deploy  - Steps to reproduce the behavior(Docker or Source code): 1. Go to 'bootcamp-master\solutions\reverse_image_search\q
  **Post-Mortem & Fix Analysis**:
  > How many images did you insert into the service? How about searching for another image, is it still 10 results?
  > Yes,the result is always 10 pictures from 17125 picture collection, no matter what picture I put in,how much top k I choose .
  > I asked this question in wechat group.One administrator said it was found first time in running server with code.This similar issue was put forward when server was started by docker.So she wanted me to submit this issue.

- **Issue #635** (2021-09-13): **milvus2.0.0rc5 requirement.txt problem**
  *Symptoms*: <!-- Please state your issue using the following template and, most importantly, in English.-->  **Describe the issue** The conflict is caused by:     pymilvus 2.0.0rc5 depends on grpcio==1.37.1     tensorflow 2.5.1 depends on grpcio~=1.34.0   **To Reproduce** - Which solution are you running? Please post the link. - Steps to reproduce the behavior(Docker or Source code): 1. pip install -r requirement.txt  **Expected behavior** pip install -r requirement.txt success  **Screenshots** ![image](https://user-images.githubusercontent.com/78945582/131969223-610067fb-638e-47f3-b8ae-c3958418e55a.png)  **Software version (please complete the following information):**  - Milvus: [e.g. 2.0.0rc5]  - Server: [e.g. 2.0.0]  - Client: [e.g. 2.0.0]   **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for your issue.  This is indeed a version conflict, it can solve by specifying the tensorflow version as 2.6.0, so needs changed **requirements.txt**, can you update it and submit us a PR?  Looking forward to having you as a contributor to Bootcamp.
  > > Hi, thanks for your issue. >  > This is indeed a version conflict, it can solve by specifying the tensorflow version as 2.6.0, so needs changed **requirements.txt**, can you update it and submit us a PR? >  > Looking forward to having you as a contributor to Bootcamp.  No problem!
  > Looking forward to your pull request :)

- **Issue #611** (2021-08-31): **Document content error**
  *Symptoms*: <!-- Please state your issue using the following template and, most importantly, in English.-->  **Describe the issue** In the 166 lines, it should be 'cd client'. 
  **Post-Mortem & Fix Analysis**:
  > merged with #610 

- **Issue #521** (2021-08-16): **cannot connect to reverse_image_search**
  *Symptoms*: reverse_image_search服务器长时间不连接，再次连接报错 ![image](https://user-images.githubusercontent.com/863935/123428334-4586cd00-d5f8-11eb-8112-e023b8a134ca.png) 
  **Post-Mortem & Fix Analysis**:
  > Thanks, this is a really good question, it is caused by long Pymysql connections and can be solved by `mysql.ping()`. ```python def test_connection():     try: 	db.ping()     except: 	db = pymysql.connect(localhost, user, passwd, port, db)     return db ``` And we will fix&update it later.  

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

### Incident Patch 1: `14cefc46` (2026-09-24)
**Commit Message**: Fix Markdown rendering in Search with Jev notebooks (#1594)

* Fix Markdown line breaks in Search with Jev notebooks

Signed-off-by: Cheney Zhang <chen.zhang@zilliz.com>

* Clarify tutorial setup and terminal search status

Signed-off-by: Cheney Zhang <chen.zhang@zilliz.com>

* Focus Jev tutorials on workflows and observed results

Signed-off-by: Cheney Zhang <chen.zhang@zilliz.com>

---------

Signed-off-by: Cheney Zhang <chen.zhang@zilliz.com>

**File**: `bootcamp/RAG/search_with_jev/README.md` (modified, +3/-3)
```diff
@@ -26,9 +26,9 @@ Start with [reranking search results](https://github.com/milvus-io/bootcamp/blob
 
 [Milvus Model](https://github.com/milvus-io/milvus-model) provides an application-side `JevRerankFunction`: pass a query and candidate document texts, and receive scored results with their original indices, sorted by relevance. Use those indices to reorder the records returned by Milvus.
 
-The [Jev integration](https://github.com/milvus-io/milvus-model/pull/90) has been merged. See the [implementation and constructor options](https://github.com/milvus-io/milvus-model/blob/main/src/pymilvus/model/reranker/jev.py) for the current API. It accepts `TYPESAFE_API_KEY` and defaults to `jev-latest`. Check that your installed package includes this integration before importing it; a merged change does not establish availability in a published package.
+The [Jev integration](https://github.com/milvus-io/milvus-model/pull/90) has been merged. See the [implementation and constructor options](https://github.com/milvus-io/milvus-model/blob/main/src/pymilvus/model/reranker/jev.py) for the current API. It accepts `TYPESAFE_API_KEY` and defaults to `jev-latest`. Use a package version that includes this integration.
 
-The current wrapper uses a claim-and-evidence relevance prompt. Check that this criterion fits your task. For custom judgments such as memory compatibility, stopping or routing, follow the linked tutorials using the TypeSafe API directly. The notebooks use that API directly and do not require the Milvus Model wrapper. Neither approach adds a Jev model to the Milvus server.
+The current wrapper uses a claim-and-evidence relevance prompt. Check that this criterion fits your task. For custom judgments such as memory compatibility, stopping or routing, follow the linked tutorials using the TypeSafe API directly. The tutorials demonstrate direct API calls from Python application code.
 
 ## Run a notebook
 
@@ -58,4 +58,4 @@ Keep exact constraints such as tenant access and software versions in applicatio
 | [DeepSearcher](https://github.com/zilliztech/deep-searcher) | Iterative search over private knowledge | [Experiment runner](https://github.com/zilliztech/deep-searcher/blob/master/evaluation/jev_stopping/run_full100.py) · [Search-stopping evaluation](https://github.com/zilliztech/deep-searcher/blob/master/evaluation/jev_stopping/README.md) (standalone experiment) |
 | [GPTCache](https://github.com/zilliztech/GPTCache) | Reuse answers to compatible requests | [Jev implementation](https://github.com/zilliztech/GPTCache/blob/main/gptcache/similarity_evaluation/jev.py) · [Evaluation](https://github.com/zilliztech/GPTCache/blob/main/examples/benchmark/reuse_compatibility/README.md) |
 
-These links lead to implementation code and task-specific evaluation records. DeepSearcher's link is a standalone stopping experiment, not a default search-agent feature. The studies use different datasets and evaluation methods; consult each report before comparing results.
+These links lead to implementation code and task-specific evaluation records. DeepSearcher's link provides a standalone stopping experiment. The studies use different datasets and evaluation methods; consult each report before comparing results.
```

**File**: `bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb` (modified, +55/-12)
```diff
@@ -5,7 +5,16 @@
    "id": "e372c7d7-2ec4-4149-bccc-3dec59106019",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb)# Screen retrieved passages with JevFlag text that attempts to redirect an assistant rather than provide evidence. This is a supplemental signal: model screening does not replace application permissions or guarantee protection against prompt injection.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/check_search_guardrails.ipynb)\n",
+    "\n",
+    "# Screen retrieved passages with Jev\n",
+    "\n",
+    "Flag text that attempts to redirect an assistant rather than provide evidence. This is a supplemental signal: model screening does not replace application permissions or guarantee protection against prompt injection.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "832151d8-b228-4445-ac49-30ea63855370",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "9330566a-2500-4f89-ba99-d86050c56498",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "9cae493b-b8a4-444f-a012-bb554b5d3257",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll names and records below are synthetic teaching exam
```

**File**: `bootcamp/RAG/search_with_jev/curate_search_data.ipynb` (modified, +56/-13)
```diff
@@ -5,7 +5,16 @@
    "id": "f47c2eda-b94e-4b97-8346-5c1c14913ced",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/curate_search_data.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/curate_search_data.ipynb)# Curate documents before indexing with JevJudge whether incoming documents contain substantive operational guidance. Use the accepted IDs to build a filtered Milvus index; review uncertain documents instead of silently publishing them.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/curate_search_data.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/curate_search_data.ipynb)\n",
+    "\n",
+    "# Curate documents before indexing with Jev\n",
+    "\n",
+    "Judge whether incoming documents contain substantive operational guidance. Use the accepted IDs to build a filtered Milvus index; review uncertain documents instead of silently publishing them.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "ac468eaf-a52f-4bee-ae0d-c87d628365cb",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "0da05cfc-8525-4e12-a539-775b644e9e80",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "245d85ea-7808-4617-9268-b3cc18d7a312",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll names and records below are synthetic teaching examples."
+    "## Prepare a small corpus\n",
+    "\n"
```

**File**: `bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb` (modified, +75/-18)
```diff
@@ -5,7 +5,16 @@
    "id": "d90f02ce-8bf1-4b79-9b30-2978224b437c",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb)# Decide when to stop searching with JevBuild a bounded search loop: Gemini Flash generates each query from the question and evidence collected so far, Milvus retrieves passages, and Jev decides whether the evidence is sufficient. Gemini writes an answer only after the stop gate passes. Compare a direct question, a two-hop question, and a question the corpus cannot answer.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/decide_search_stopping.ipynb)\n",
+    "\n",
+    "# Decide when to stop searching with Jev\n",
+    "\n",
+    "Build a bounded search loop: Gemini Flash generates each query from the question and evidence collected so far, Milvus retrieves passages, and Jev decides whether the evidence is sufficient. Gemini writes an answer only after the stop gate passes. Compare a direct question, a two-hop question, and a question the corpus cannot answer.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "2310bb53-b550-4963-afef-ae01aeea1a5c",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini receives synthetic documents and queries for embedding, and the question, search history and accumulated evidence for query/answer generation; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini receives synthetic documents and queries for embedding, and the question, search history and accumulated evidence for query/answer generation; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "8da53bb5-23e6-40a2-a681-3927a3ca7854",
    "metadata": {},
    "source": [
-    "### C
```

**File**: `bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb` (modified, +62/-13)
```diff
@@ -5,7 +5,16 @@
    "id": "010253d3-c133-4661-8594-88b818f14cc9",
    "metadata": {},
    "source": [
-    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb)[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb)# Evaluate search evidence with JevUse Jev as a judge after retrieval: assess passage relevance, evidence sufficiency and whether a proposed answer is supported. Compare a few judgments with hand-written labels to illustrate judge validation, not to claim benchmark quality.## PreparationRun locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
+    "[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb)\n",
+    "[![View on GitHub](https://img.shields.io/badge/View_on-GitHub-181717?logo=github)](https://github.com/milvus-io/bootcamp/blob/master/bootcamp/RAG/search_with_jev/evaluation_with_jev.ipynb)\n",
+    "\n",
+    "# Evaluate search evidence with Jev\n",
+    "\n",
+    "Use Jev as a judge after retrieval: assess passage relevance, evidence sufficiency and whether a proposed answer is supported. Compare a few judgments with hand-written labels to illustrate judge validation, not to claim benchmark quality.\n",
+    "\n",
+    "## Preparation\n",
+    "\n",
+    "Run locally from this directory with `uv sync --python 3.12` and `uv run jupyter lab`, or install the notebook dependencies in Colab:"
    ]
   },
   {
@@ -31,7 +40,11 @@
    "id": "96d3940b-bbf3-42d2-a25c-deacc1ef9e36",
    "metadata": {},
    "source": [
-    "> In Colab, restart the runtime after installing dependencies if needed.Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop the tutorial rather than produce fabricated scores."
+    "> In Colab, restart the runtime after installing dependencies if needed.\n",
+    "\n",
+    "Set `GEMINI_API_KEY` and `TYPESAFE_API_KEY` in your environment or enter them privately below. A `GOOGLE_API_KEY` is also accepted for Gemini. Obtain a Gemini key from [Google AI Studio](https://aistudio.google.com/apikey) and a TypeSafe key from the [TypeSafe console](https://console.typesafe.ai/). Gemini embeds the synthetic documents and queries; TypeSafe receives the sample evidence and judgment questions. Both services require API access and may consume credits.\n",
+    "\n",
+    "The helper batches independent questions into one request. IDs map responses back to code; the instructions explicitly identify each field being judged. HTTP failures stop execution with an error."
    ]
   },
   {
@@ -79,7 +92,9 @@
    "id": "4759dd0b-5911-4e80-877f-0a44f93c997d",
    "metadata": {},
    "source": [
-    "### Call JevThis helper sends independent questions in one request and validates the returned answers."
+    "### Call Jev\n",
+    "\n",
+    "This helper sends independent questions in one request and validates the returned answers."
    ]
   },
   {
@@ -149,7 +164,9 @@
    "id": "47abfd19-896f-44e7-b877-b59fc59e2235",
    "metadata": {},
    "source": [
-    "## Prepare a small corpusAll names and records below
```

---

### Incident Patch 2: `72792d61` (2026-08-24)
**Commit Message**: Update Basic Memory Milvus installation (#1589)

Signed-off-by: Cheney Zhang <chen.zhang@zilliz.com>

**File**: `integration/basic_memory_with_milvus.md` (modified, +1/-8)
```diff
@@ -27,14 +27,7 @@ You need:
 - A PostgreSQL database and its `postgresql+asyncpg://...` connection URL
 - An OpenAI API key
 
-Milvus support has been merged into Basic Memory but is not yet available in its current PyPI release. Until the next release is published, install the tested upstream commit that includes the Milvus restart fix:
-
-```bash
-uv tool install --python 3.12 \
-  "basic-memory[milvus] @ git+https://github.com/basicmachines-co/basic-memory.git@eedce9bb92750282ceec73f420bb6ef05e954d4c"
-```
-
-After Basic Memory publishes a release containing the integration, the installation can be simplified to:
+Install Basic Memory with its Milvus optional dependencies from PyPI:
 
 ```bash
 uv tool install --python 3.12 "basic-memory[milvus]"
```

---

### Incident Patch 3: `17d1bb31` (2026-02-28)
**Commit Message**: add architecture diagram to multimodal RAG notebook and fix black formatting (#1578)

Signed-off-by: cheney <chen.zhang@zilliz.com>
Co-authored-by: Jael Gu <mengjia.gu@zilliz.com>

**File**: `tutorials/quickstart/apps/rag_search_with_milvus/app.py` (modified, +0/-1)
```diff
@@ -9,7 +9,6 @@
 
 from dotenv import load_dotenv
 
-
 load_dotenv()
 COLLECTION_NAME = os.getenv("COLLECTION_NAME")
 MILVUS_ENDPOINT = os.getenv("MILVUS_ENDPOINT")
```

**File**: `tutorials/quickstart/apps/rag_search_with_milvus/insert.py` (modified, +0/-1)
```diff
@@ -10,7 +10,6 @@
 
 from dotenv import load_dotenv
 
-
 load_dotenv()
 COLLECTION_NAME = os.getenv("COLLECTION_NAME")
 MILVUS_ENDPOINT = os.getenv("MILVUS_ENDPOINT")
```

**File**: `tutorials/quickstart/multimodal_rag_with_milvus.ipynb` (modified, +6/-4)
```diff
@@ -27,6 +27,11 @@
     "This tutorial showcases the multimodal RAG powered by Milvus, [Visualized BGE model](https://github.com/FlagOpen/FlagEmbedding/tree/master/FlagEmbedding/visual), and [GPT-4o](https://openai.com/index/hello-gpt-4o/). With this system, users are able to upload an image and edit text instructions, which are processed by BGE's composed retrieval model to search for candidate images. GPT-4o then acts as a reranker, selecting the most suitable image and providing the rationale behind the choice. This powerful combination enables a seamless and intuitive image search experience, leveraging Milvus for efficient retrieval, BGE model for precise image processing and matching, and GPT-4o for advanced reranking."
    ]
   },
+  {
+   "cell_type": "markdown",
+   "source": "<img src=\"../../pics/multimodal_rag_with_milvus.png\" width=\"100%\" />",
+   "metadata": {}
+  },
   {
    "cell_type": "markdown",
    "metadata": {},
@@ -193,7 +198,6 @@
     "from tqdm import tqdm\n",
     "from glob import glob\n",
     "\n",
-    "\n",
     "# Generate embeddings for the image dataset\n",
     "data_dir = (\n",
     "    \"./images_folder\"  # Change to your own value if using a different data directory\n",
@@ -255,7 +259,6 @@
    "source": [
     "from pymilvus import MilvusClient\n",
     "\n",
-    "\n",
     "dim = len(list(image_dict.values())[0])\n",
     "collection_name = \"multimodal_rag_demo\"\n",
     "\n",
@@ -512,7 +515,6 @@
     "import requests\n",
     "import base64\n",
     "\n",
-    "\n",
     "openai_api_key = \"sk-***\"  # Change to your OpenAI API Key\n",
     "\n",
     "\n",
@@ -668,4 +670,4 @@
  },
  "nbformat": 4,
  "nbformat_minor": 2
-}
+}
\ No newline at end of file
```

**File**: `tutorials/quickstart/text_image_search_with_milvus.ipynb` (modified, +0/-3)
```diff
@@ -127,7 +127,6 @@
     "import clip\n",
     "from PIL import Image\n",
     "\n",
-    "\n",
     "# Load CLIP model\n",
     "model_name = \"ViT-B/32\"\n",
     "model, preprocess = clip.load(model_name)\n",
@@ -228,7 +227,6 @@
     "import os\n",
     "from glob import glob\n",
     "\n",
-    "\n",
     "image_dir = \"./images_folder/train\"\n",
     "raw_data = []\n",
     "\n",
@@ -303,7 +301,6 @@
    "source": [
     "from IPython.display import display\n",
     "\n",
-    "\n",
     "width = 150 * 5\n",
     "height = 150 * 2\n",
     "concatenated_image = Image.new(\"RGB\", (width, height))\n",
```

#### Recent Merged Pull Requests:
- **PR #1594** (2026-09-24): Fix Markdown rendering in Search with Jev notebooks (@zc277584121)
- **PR #1593** (2026-09-23): Improve Search with Jev tutorials with realistic workflows and visible decisions (@zc277584121)
- **PR #1592** (2026-09-22): Add Jev and Milvus search cookbook (@zc277584121)
- **PR #1591** (2026-09-08): Add EverOS integration guide for Milvus (@zc277584121)
- **PR #1590** (2026-08-31): Replace MemPalace notebook with a CLI-based Milvus guide (@zc277584121)
- **PR #1589** (2026-08-24): Update Basic Memory Milvus installation (@zc277584121)
- **PR #1587** (2026-08-11): Add Google ADK and MemPalace Milvus notebooks (@zc277584121)
- **PR #1586** (2026-04-20): Remove outdated ColPali multi-modal retrieval notebook (@zc277584121)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
