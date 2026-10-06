# Forensic Learning Record (Deep Inspection): jpush/aurora-imui

> **Canonical Artifact**: `07_PROJECT_LEARNING/jpush-aurora-imui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jpush/aurora-imui](https://github.com/jpush/aurora-imui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:53:50.154Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jpush/aurora-imui`
- **Description**: General IM UI components. Android/iOS/RectNative ready.  通用 IM 聊天 UI 组件，已经同时支持 Android/iOS/RN。
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5689 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ReactNative_JS/MessageState.js`
```
import React, {Component} from 'react'
import { View, Image, ActivityIndicator, StyleSheet, TouchableWithoutFeedback } from 'react-native'

const styles = StyleSheet.create({
  stateContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 10.0,
  },
  stateView: {
    width: 20.0,
    height: 20.0,
  }
})

export default class MessageState extends Component {
  constructor(props) {
    super(props)
    this._renderStateView = this._renderStateView.bind(this)
    this._onClick = this._onClick.bind(this)
  }
  
  // 'send_succeed', 'send_failed', 'send_going', 'download_failed'
  _renderStateView() {
    switch(this.props.status) {
      case 'send_failed':
        return <Image style={styles.stateView} source={require('./assert/fail.png')}/>
      case 'send_going':
        return <ActivityIndicator style={styles.stateView} color='red'/>
      case 'send_succeed':
      default:
        return null
    }
  }

  _onClick() {
    this.props.onStatusViewClick && 
      this.props.onStatusViewClick.constructor === Function &&
      this.props.onStatusViewClick({...this.props})
  }

  render() {
    return <TouchableWithoutFeedback
      onPress={this._onClick}
    >
      <View
        style={[styles.stateContainer, this.props.stateContainerStyles]}
      >
        {this._renderStateView()}
      </View>
    </TouchableWithoutFeedback>
  }
}
```

### Core Architecture Module: `ReactNative/chatinput.android.js`
```
'use strict';

import React from 'react';
import ReactNative from 'react-native';
import PropTypes from 'prop-types';
import {ViewPropTypes} from 'react-native';

var {
	Component,
} = React;

var {
	StyleSheet,
	View,
	Dimensions,
	requireNativeComponent,
	UIManager,
	findNodeHandle,
  } = ReactNative;

const CHAT_INPUT = "chat_input";

export default class ChatInput extends Component {

	constructor(props) {
		super(props);
		this._onSendText = this._onSendText.bind(this);
		this._onSendFiles = this._onSendFiles.bind(this);
		this._takePicture = this._takePicture.bind(this);
		this._startVideoRecord = this._startVideoRecord.bind(this);
		this._finishVideoRecord = this._finishVideoRecord.bind(this);
		this._cancelVideoRecord = this._cancelVideoRecord.bind(this);
		this._onStartRecordVoice = this._onStartRecordVoice.bind(this);
		this._onFinishRecordVoice = this._onFinishRecordVoice.bind(this);
		this._onCancelRecordVoice = this._onCancelRecordVoice.bind(this);
		this._onSwitchToMicrophoneMode = this._onSwitchToMicrophoneMode.bind(this);
		this._onSwitchGalleryMode = this._onSwitchGalleryMode.bind(this);
		this._onSwitchToCameraMode = this._onSwitchToCameraMode.bind(this);
		this._onSwitchToEmojiMode = this._onSwitchToEmojiMode.bind(this);
		this._onTouchEditText = this._onTouchEditText.bind(this);
		this._onFullScreen = this._onFullScreen.bind(this);
		this._onRecoverScreen = this._onRecoverScreen.bind(this);
		this._onSizeChange = this._onSizeChange.bind(this);
		this._onClickSelectAlbum = this._onClickSelectAlbum.bind(this);
		this._closeCamera = this._closeCamera.bind(this);
		this._switchCameraMode = this._switchCameraMode.bind(this);
	}

	_onSendText(event: Event) {
		if (!this.props.onSendText) {
			return;
		}
		this.props.onSendText(event.nativeEvent.text);
	}

	_onSendFiles(event: Event) {
		if (!this.props.onSendGalleryFiles) {
			return;
		}
		this.props.onSendGalleryFiles(event.nativeEvent.mediaFiles);
	}

	_takePicture(event: Event) {
		if (!this.props.onTakePicture) {
			return;
		}
		this.props.onTakePicture(event.nativeEvent);
	}

	_startVideoRecord() {
		if (!this.props.onStartRecordVideo) {
			return;
		}
		this.props.onStartRecordVideo();
	}

	_finishVideoRecord(event: Event) {
		if (!this.props.onFinishRecordVideo) {
			return;
		}
		this.props.onFinishRecordVideo(event.nativeEvent);
	}

	_cancelVideoRecord() {
		if (!this.props.onCancelRecordVideo) {
			return;
		}
		this.props.onCancelRecordVideo();
	}

	_onStartRecordVoice() {
		if (!this.props.onStartRecordVoice) {
			return;
		}
		this.props.onStartRecordVoice();
	}

	_onFinishRecordVoice(event: Event) {
		if (!this.props.onFinishRecordVoice) {
			return;
		}
		this.props.onFinishRecordVoice(event.nativeEvent.mediaPath, event.nativeEvent.duration);
	}

	_onCancelRecordVoice() {
		if (!this.props.onCancelRecordVoice) {
			return;
		}
		this.props.onCancelRecordVoice();
	}

	_onSwitchToMicrophoneMode() {
		if (!this.props.onSwitchToMicrophoneMode) {
			return;
		}
		this.props.onSwitchToMicrophoneMode();
	}

	_onSwitchGalleryMode() {
		if (!this.props.onSwitchToGalleryMode) {
			return;
		}
		this.props.onSwitchToGalleryMode();
	}

	_onSwitchToCameraMode() {
		if (!this.props.onSwitchToCameraMode) {
			return;
		}
		this.props.onSwitchToCameraMode();
	}

	_onSwitchToEmojiMode() {
		if (!this.props.onSwitchToEmojiMode) {
			return;
		}
		this.props.onSwitchToEmojiMode();
	}

	_onTouchEditText() {
		if (!this.props.onTouchEditText) {
			return;
		}
		this.props.onTouchEditText();
	}

	_onFullScreen() {
		if (!this.props.onFullScreen) {
			return;
		}
		this.props.onFullScreen();
	}

	_onRecoverScreen() {
		if (!this.props.onRecoverScreen) {
			return;
		}
		this.props.onRecoverScreen();
	}

	_onSizeChange(event: Event) {
		if (!this.props.onSizeChange) {
			return;
		}
		this.props.onSizeChange({ width: Dimensions.get('window').width, height: event.nativeEvent.height });
	}

	_onClickSelectAlbum(event: Event) {
		if (!this.props.onClickSelectAlbum) {
			return;
		}
		this.props.onClickSelectAlbum();
	}

	_closeCamera(event: Event) {
		if (!this.props.closeCamera) {
			return;
		}
		this.props.closeCamera();
	}

	_switchCameraMode(event: Event) {
		if (!this.props.switchCameraMode) {
			return;
		}
		this.props.switchCameraMode(event.nativeEvent.isRecordVideoMode);
	}

	setMenuContainerHeight(height) {
		UIManager.dispatchViewManagerCommand(findNodeHandle(this.refs[CHAT_INPUT]), 99, [height]);
	}

	closeSoftInput() {
		UIManager.dispatchViewManagerCommand(findNodeHandle(this.refs[CHAT_INPUT]), 100, null);
	}

	getInputText() {
		UIManager.dispatchViewManagerCommand(findNodeHandle(this.refs[CHAT_INPUT]), 101, null);
	}

	showMenu(flag) {
		UIManager.dispatchViewManagerCommand(findNodeHandle(this.refs[CHAT_INPUT]), 102, [flag]);
	}

	render() {
		return (
			<RCTChatInput
				ref={CHAT_INPUT}
				{...this.props}
				onSendText={this._onSendText}
				onSendGalleryFiles={this._onSendFiles}
				onTakePicture={this._takePicture}
				onStartRecordVideo={this._startVideoRecord}
				onFinishRecordVideo={this._finishVideoRecord}
				onCancelRecordVideo={this._cancelVideoRecord}
				onStartRecordVoice={this._onStartRecordVoice}
				onFinishRecordVoice={this._onFinishRecordVoice}
				onCancelRecordVoice={this._onCancelRecordVoice}
				onSwitchToMicrophoneMode={this._onSwitchToMicrophoneMode}
				onSwitchToGalleryMode={this._onSwitchGalleryMode}
				onSwitchToCameraMode={this._onSwitchToCameraMode}
				onTouchEditText={this._onTouchEditText}
				onFullScreen={this._onFullScreen}
				onRecoverScreen={this._onRecoverScreen}
				onSizeChange={this._onSizeChange}
				onClickSelectAlbum={this._onClickSelectAlbum}
				closeCamera={this._closeCamera}
				switchCameraMode={this._switchCameraMode}
			/>
		);
	}

}

ChatInput.propTypes = {
  chatInputBackgroundColor: PropTypes.string,
  menuContainerHeight: PropTypes.number,
  isDismissMenuContainer: PropTypes.bool,
  onSendText: PropTypes.func,
  onSendGalleryFiles: PropTypes.func,
  onTakePicture: PropTypes.func,
  onStartRecordVideo: PropTypes.func,
  onFinishRecordVideo: PropTypes.func,
  onCancelRecordVideo: PropTypes.func,
  onStartRecordVoice: PropTypes.func,
  onFinishRecordVoice: PropTypes.func,
  onCancelRecordVoice: PropTypes.func,
  onSwitchToMicrophoneMode: PropTypes.func,
  onSwitchToGalleryMode: PropTypes.func,
  onSwitchToCameraMode: PropTypes.func,
  onSwitchToEmojiMode: PropTypes.func,
  onTouchEditText: PropTypes.func,
  onFullScreen: PropTypes.func,
  onRecoverScreen: PropTypes.func,
  onSizeChange: PropTypes.func,
  closeCamera: PropTypes.func,
  switchCameraMode: PropTypes.func,
  inputViewHeight: PropTypes.number,
  onClickSelectAlbum: PropTypes.func,
  showSelectAlbumBtn: PropTypes.bool,
  showRecordVideoBtn: PropTypes.bool,
  inputPadding: PropTypes.object,
  inputTextColor: PropTypes.string,
  inputTextSize: PropTypes.number,
  inputTextLineHeight: PropTypes.number,
  hideCameraButton: PropTypes.bool,
  hideVoiceButton: PropTypes.bool,
  hideEmojiButton: PropTypes.bool,
  hidePhotoButton: PropTypes.bool,
  customLayoutItems: PropTypes.object,
  cameraQuality: PropTypes.number,
  ...ViewPropTypes
};

var RCTChatInput = requireNativeComponent('RCTChatInput', ChatInput);
```

### Core Architecture Module: `ReactNative/chatinput.ios.js`
```
'use strict';

import React from 'react';
import ReactNative from 'react-native';
import PropTypes from 'prop-types';
import {ViewPropTypes} from 'react-native';

var {
  Component,
} = React;

var {
  StyleSheet,
  requireNativeComponent,
} = ReactNative;

export default class ChatInput extends Component {

  constructor(props) {
    super(props);
    this._onSendText = this._onSendText.bind(this);
    this._onSendFiles = this._onSendFiles.bind(this);
    this._takePicture = this._takePicture.bind(this);
    this._startVideoRecord = this._startVideoRecord.bind(this);
    this._finishVideoRecord = this._finishVideoRecord.bind(this);
    this._onStartRecordVoice = this._onStartRecordVoice.bind(this);
    this._onFinishRecordVoice = this._onFinishRecordVoice.bind(this);
    this._onCancelRecordVoice = this._onCancelRecordVoice.bind(this);
    this._onSwitchToMicrophoneMode = this._onSwitchToMicrophoneMode.bind(this);
    this._onSwitchToEmojiMode = this._onSwitchToEmojiMode.bind(this);
    this._onSwitchGalleryMode = this._onSwitchGalleryMode.bind(this);
    this._onSwitchToCameraMode = this._onSwitchToCameraMode.bind(this);
    this._onShowKeyboard = this._onShowKeyboard.bind(this);
    this._onSizeChange = this._onSizeChange.bind(this);
    this._onFullScreen = this._onFullScreen.bind(this);
		this._onRecoverScreen = this._onRecoverScreen.bind(this);
  }

  _onSendText(event: Event) {
    if (!this.props.onSendText) {
      return;
    }
    this.props.onSendText(event.nativeEvent.text);
  }

  _onSendFiles(event: Event) {
    if (!this.props.onSendGalleryFiles) {
      return;
    }
    this.props.onSendGalleryFiles(event.nativeEvent.mediaFiles);
  }

  _takePicture(event: Event) {
    if (!this.props.onTakePicture) {
      return;
    }
    this.props.onTakePicture(event.nativeEvent);
  }

  _startVideoRecord() {
    if (!this.props.onStartRecordVideo) {
      return;
    }
    this.props.onStartRecordVideo();
  }

  _finishVideoRecord(event: Event) {
    if (!this.props.onFinishRecordVideo) {
      return;
    }
    this.props.onFinishRecordVideo(event.nativeEvent);
  }

  _onStartRecordVoice() {
    if (!this.props.onStartRecordVoice) {
      return;
    }
    this.props.onStartRecordVoice();
  }

  _onFinishRecordVoice(event: Event) {
    if (!this.props.onFinishRecordVoice) {
      return;
    }
    this.props.onFinishRecordVoice(event.nativeEvent.mediaPath, event.nativeEvent.duration);
  }

  _onCancelRecordVoice() {
    if (!this.props.onCancelRecordVoice) {
      return;
    }
    this.props.onCancelRecordVoice();
  }

  _onSwitchToMicrophoneMode() {
    if (!this.props.onSwitchToMicrophoneMode) {
      return;
    }
    this.props.onSwitchToMicrophoneMode();
  }

  _onSwitchToEmojiMode() {
    if (!this.props.onSwitchToEmojiMode) {
      return;
    }
    this.props.onSwitchToEmojiMode();
  }

  _onSwitchGalleryMode() {
    if (!this.props.onSwitchToGalleryMode) {
      return;
    }
    this.props.onSwitchToGalleryMode();
  }

  _onSwitchToCameraMode() {
    if (!this.props.onSwitchToCameraMode) {
      return;
    }
    this.props.onSwitchToCameraMode();
  }

  _onShowKeyboard(event: Event) {
    if (!this.props.onShowKeyboard) {
      return;
    }

    this.props.onShowKeyboard(event.nativeEvent.keyboard_height);
  }

  _onSizeChange(event: Event) {
    if (!this.props.onSizeChange) {
      return;
    }

    this.props.onSizeChange(event.nativeEvent);
  }

  _onFullScreen() {
		if (!this.props.onFullScreen) {
			return;
		}
		this.props.onFullScreen();
	}

	_onRecoverScreen() {
		if (!this.props.onRecoverScreen) {
			return;
		}
		this.props.onRecoverScreen();
	}

  render() {
    return (
      <RCTChatInput 
          {...this.props} 
          onSendText={this._onSendText}
          onSendGalleryFiles={this._onSendFiles}
          onTakePicture={this._takePicture}
          onStartRecordVideo={this._startVideoRecord}
          onFinishRecordVideo={this._finishVideoRecord}
          onStartRecordVoice={this._onStartRecordVoice}
          onFinishRecordVoice={this._onFinishRecordVoice}
          onCancelRecordVoice={this._onCancelRecordVoice}
          onSwitchToMicrophoneMode={this._onSwitchToMicrophoneMode}
          onSwitchToEmojiMode={this._onSwitchToEmojiMode}
          onSwitchToGalleryMode={this._onSwitchGalleryMode}
          onSwitchToCameraMode={this._onSwitchToCameraMode}
          onShowKeyboard={this._onShowKeyboard}
          onSizeChange={this._onSizeChange}
          onFullScreen={this._onFullScreen}
          onRecoverScreen={this._onRecoverScreen}
      />
    );
  }

}

ChatInput.propTypes = {
  chatInputBackgroundColor: PropTypes.string,
  menuContainerHeight: PropTypes.number,
  onSendText: PropTypes.func,
  onSendGalleryFiles: PropTypes.func,
  onTakePicture: PropTypes.func,
  onStartRecordVideo: PropTypes.func,
  onFinishRecordVideo: PropTypes.func,
  onStartRecordVoice: PropTypes.func,
  onFinishRecordVoice: PropTypes.func,
  onCancelRecordVoice: PropTypes.func,
  onSwitchToMicrophoneMode: PropTypes.func,
  onSwitchToEmojiMode: PropTypes.func,
  onSwitchToGalleryMode: PropTypes.func,
  onSwitchToCameraMode: PropTypes.func,
  onShowKeyboard: PropTypes.func,
  onSizeChange: PropTypes.func,
  onFullScreen: PropTypes.func,
	onRecoverScreen: PropTypes.func,
  galleryScale: PropTypes.number,
  compressionQuality: PropTypes.number,
  customLayoutItems: PropTypes.object,
  inputPadding: PropTypes.object,
	inputTextColor: PropTypes.string,
	inputTextSize: PropTypes.number,
  ...ViewPropTypes
};

var RCTChatInput = requireNativeComponent('RCTInputView', ChatInput);
```

### Core Architecture Module: `ReactNative/ios/RCTAuroraIMUI/IMUICustomMessageContentView.swift`
```
//
//  IMUICustomMessageContentView.swift
//  RCTAuroraIMUI
//
//  Created by oshumini on 2017/11/7.
//  Copyright © 2017年 HXHG. All rights reserved.
//

import UIKit
import WebKit

class IMUICustomMessageContentView: UIView, IMUIMessageContentViewProtocol {

  var customView : WKWebView?
  
  override init(frame: CGRect) {
    super.init(frame: frame)
    let jsStr = "var meta = document.createElement('meta'); meta.setAttribute('name', 'viewport'); meta.setAttribute('content', 'width=device-width'); document.getElementsByTagName('head')[0].appendChild(meta);"
    let script = WKUserScript(source: jsStr, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
    let contentController = WKUserContentController()
    contentController.addUserScript(script)
    
    let config = WKWebViewConfiguration()
    config.userContentController = contentController
    self.customView = WKWebView(frame: CGRect.zero, configuration: config)
    self.addSubview(self.customView!)
    self.customView?.isUserInteractionEnabled = false
  }
  
  required public init?(coder aDecoder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  func layoutContentView(message: IMUIMessageModelProtocol) {
    customView!.frame = CGRect(origin: CGPoint.zero, size: message.layout.bubbleContentSize)
    customView!.loadHTMLString(message.text(), baseURL: Bundle.main.bundleURL)
  }
}


```

### Core Architecture Module: `ReactNative/ios/RCTAuroraIMUI/MessageEventCollectionViewCell.swift`
```
//
//  MessageEventCollectionViewCell.swift
//  sample
//
//  Created by oshumini on 2017/6/16.
//  Copyright © 2017年 HXHG. All rights reserved.
//

import UIKit

@objc open class MessageEventCollectionViewCell: UICollectionViewCell {
  static var paddingGap:CGFloat = 5.0
  @objc public static var eventFont: UIFont = UIFont.systemFont(ofSize: 12)
  @objc public static var eventTextColor: UIColor = UIColor.white
  @objc public static var eventBackgroundColor: UIColor = UIColor(netHex: 0xCECECE)
  @objc public static var eventCornerRadius: CGFloat = 3.0//
  @objc public static var eventTextLineHeight: CGFloat = 2.0// TODO:
  
  
  static var maxWidth: CGFloat = 200.0
  @objc public static var contentInset: UIEdgeInsets = UIEdgeInsets(top: 6, left: 8, bottom: 6, right: 8)//
  
  var eventLabel = IMUITextView()
  
  override init(frame: CGRect) {
    super.init(frame: frame)
    
    self.contentView.addSubview(eventLabel)
    eventLabel.backgroundColor = MessageEventCollectionViewCell.eventBackgroundColor
    eventLabel.frame = CGRect(x: 0, y: 0, width: 300, height: 20)
    eventLabel.font = MessageEventCollectionViewCell.eventFont
    eventLabel.numberOfLines = 0
    eventLabel.layer.cornerRadius = MessageEventCollectionViewCell.eventCornerRadius
    eventLabel.layer.masksToBounds = true
    eventLabel.contentInset = MessageEventCollectionViewCell.contentInset
    eventLabel.textColor = MessageEventCollectionViewCell.eventTextColor
    
    eventLabel.textAlignment = .center
  }
  
  @objc open func presentCell(event: MessageEventModel) {
    eventLabel.text = event.eventText                                                                                                                                                                                                                                                                                               
    let eventX = (IMUIMessageCellLayout.cellWidth - event.eventSize.width)/2
    let eventY = MessageEventCollectionViewCell.paddingGap
      
    eventLabel.frame = CGRect(x: Int(eventX),
                              y: Int(eventY),
                              width: Int(event.eventSize.width + 1),
                              height: Int(event.eventSize.height + 1))
//    eventLabel.center = self.contentView.center
//    eventLabel.frame.origin.y = MessageEventCollectionViewCell.paddingGap
  }
  
  required public init?(coder aDecoder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

```

### Core Architecture Module: `ReactNative/ios/RCTAuroraIMUI/MessageEventModel.swift`
```
//
//  MessageEventModel.swift
//  sample
//
//  Created by oshumini on 2017/6/16.
//  Copyright © 2017年 HXHG. All rights reserved.
//

import Foundation

@objc open class MessageEventModel: NSObject, IMUIMessageProtocol {

  public var msgId: String = ""
  public var eventText: String = ""
  
  var eventSize: CGSize = CGSize.zero
  
  public init(msgId: String, eventText: String) {
    super.init()
    self.msgId = msgId
    self.eventText = eventText
  }
  
  @objc public convenience init(messageDic: NSDictionary) {
    let msgId = messageDic["msgId"]
    let eventText = messageDic["text"]
    
    self.init(msgId: msgId as! String, eventText: eventText as! String)
    self.eventSize = MessageEventModel.calculateTextContentSize(text: eventText as! String)
  }
  
  static func calculateTextContentSize(text: String) -> CGSize {
      var contentSize = text.sizeWithConstrainedWidth(with: MessageEventCollectionViewCell.maxWidth, font: MessageEventCollectionViewCell.eventFont)
      return CGSize(width: MessageEventCollectionViewCell.contentInset.left +
                           MessageEventCollectionViewCell.contentInset.right +
                           contentSize.width
                 , height: MessageEventCollectionViewCell.contentInset.top +
                           MessageEventCollectionViewCell.contentInset.bottom +
                           contentSize.height)
  }
  
  @objc public func cellHeight() -> CGFloat {
    return self.eventSize.height + MessageEventCollectionViewCell.paddingGap * 2.0;
  }
}

```

### Core Architecture Module: `ReactNative/ios/RCTAuroraIMUI/MyMessageModel.swift`
```
//
//  MyMessageModel.swift
//  IMUIChat
//
//  Created by oshumini on 2017/3/5.
//  Copyright © 2017年 HXHG. All rights reserved.
//

import UIKit



open class RCTMessageModel: IMUIMessageModel {
  static let kMsgKeyStatus = "status"
  static let kMsgStatusSuccess = "send_succeed"
  static let kMsgStatusSending = "send_going"
  static let kMsgStatusFail = "send_failed"
  static let kMsgStatusDownloadFail = "download_failed"
  static let kMsgStatusDownloading = "downloading"
  

  
  static let kMsgKeyMsgType = "msgType"
  static let kMsgTypeText = "text"
  static let kMsgTypeVoice = "voice"
  static let kMsgTypeImage = "image"
  static let kMsgTypeVideo = "video"
  static let kMsgTypeCustom = "custom"

  static let kMsgKeyMsgId = "msgId"
  static let kMsgKeyFromUser = "fromUser"
  static let kMsgKeyText = "text"
  static let kMsgKeyisOutgoing = "isOutgoing"
  static let kMsgKeyMediaFilePath = "mediaPath"
  static let kMsgKeyImageUrl = "imageUrl"
  static let kMsgKeyDuration = "duration"
  static let kMsgKeyContentSize = "contentSize"
  static let kMsgKeyContent = "content"
  static let kMsgKeyExtras = "extras"
  
  static let kUserKeyUerId = "userId"
  static let kUserKeyDisplayName = "diaplayName"
  static let kUserAvatarPath = "avatarPath"
  
  static let ktimeString = "timeString"
  
  
  open var myTextMessage: String = ""
  
  var mediaPath: String = ""
  var imageUrl: String = ""
  var extras: NSDictionary?
  
  override open func mediaFilePath() -> String {
    return mediaPath
  }

  override open func webImageUrl() -> String {
    return imageUrl
  }
  
  @objc static public var outgoingBubbleImage: UIImage = {
    var bubbleImg = UIImage.imuiImage(with: "outGoing_bubble")
    bubbleImg = bubbleImg?.resizableImage(withCapInsets: UIEdgeInsets(top: 24, left: 10, bottom: 9, right: 15), resizingMode: .tile)
    return bubbleImg!
  }()
  
  @objc static public var incommingBubbleImage: UIImage = {
    var bubbleImg = UIImage.imuiImage(with: "inComing_bubble")
    bubbleImg = bubbleImg?.resizableImage(withCapInsets: UIEdgeInsets(top: 24, left: 15, bottom: 9, right: 10), resizingMode: .tile)
    return bubbleImg!
  }()
  
  @objc override open var resizableBubbleImage: UIImage {
    if isOutGoing {
      return RCTMessageModel.outgoingBubbleImage
    } else {
      return RCTMessageModel.incommingBubbleImage
    }
  }
  
  @objc public init(msgId: String, messageStatus: IMUIMessageStatus, fromUser: RCTUser, isOutGoing: Bool, time: String, type: String, text: String, mediaPath: String, imageUrl: String, layout: IMUIMessageCellLayoutProtocol, duration: CGFloat, extras: NSDictionary?) {
    
    self.myTextMessage = text
    self.mediaPath = mediaPath
    self.extras = extras
    self.imageUrl = imageUrl
    super.init(msgId: msgId, messageStatus: messageStatus, fromUser: fromUser, isOutGoing: isOutGoing, time: time, type: type, cellLayout: layout, duration: duration)
  }
  
  @objc public convenience init(messageDic: NSDictionary) {
    
    let msgId = messageDic.object(forKey: RCTMessageModel.kMsgKeyMsgId) as! String
    let msgTypeString = messageDic.object(forKey: RCTMessageModel.kMsgKeyMsgType) as? String
    let statusString = messageDic.object(forKey: RCTMessageModel.kMsgKeyStatus) as? String
    let isOutgoing = messageDic.object(forKey: RCTMessageModel.kMsgKeyisOutgoing) as? Bool
    
    var timeString = messageDic.object(forKey: RCTMessageModel.ktimeString) as? String
    let duration = messageDic.object(forKey: RCTMessageModel.kMsgKeyDuration) as? NSNumber
    let durationTime = CGFloat(duration?.floatValue ?? 0.0)
    
    var needShowTime = false
    var timeContentSize: CGSize = CGSize.zero
    if let timeString = timeString {
      if timeString != "" {
        needShowTime = true
        timeContentSize = RCTMessageModel.calculateNameContentSize(text: timeString)
      }
    } else {
      timeString = ""
    }

    let extras = messageDic.object(forKey: RCTMessageModel.kMsgKeyExtras) as? NSDictionary
    if let _ = extras {
      
    }
    
    var mediaPath = messageDic.object(forKey: RCTMessageModel.kMsgKeyMediaFilePath) as? String
    var imgUrl = ""
    if let _ = mediaPath {
      if FileManager.default.fileExists(atPath: mediaPath!) {
      } else {
        imgUrl = mediaPath!
        mediaPath = ""
      }
    } else {
      mediaPath = ""
    }
    
    var text = messageDic.object(forKey: RCTMessageModel.kMsgKeyText) as? String
    if let _ = text {
      
    } else {
      text = ""
    }
    
    var msgType: String?
    // TODO: duration
    let userDic = messageDic.object(forKey: RCTMessageModel.kMsgKeyFromUser) as? NSDictionary
    let user = RCTUser(userDic: userDic!)
    
    var messageLayout: MyMessageCellLayout?
    if let typeString = msgTypeString {
      msgType = typeString
      if typeString == RCTMessageModel.kMsgTypeText {
        
        messageLayout = MyMessageCellLayout(isOutGoingMessage: isOutgoing ?? true,
                                               isNeedShowTime: needShowTime,
                                            bubbleContentSize: RCTMessageModel.calculateTextContentSize(text: text!,
                                                                                                  isOutGoing: isOutgoing!),
                                          bubbleContentInsets: UIEdgeInsets.zero,
                                         timeLabelContentSize: timeContentSize,
                                                         type: RCTMessageModel.kMsgTypeText)
      }
      
      if typeString == RCTMessageModel.kMsgTypeImage {
        var imgSize = CGSize(width: 120, height: 160)
        if let img = UIImage(contentsOfFile: mediaPath!) {
          imgSize = RCTMessageModel.converImageSize(with: CGSize(width: img.size.width, height: img.size.height))
        } else {
          imgSize = CGSize(width: 120, height: 160)
        }
        
        messageLayout = MyMessageCellLayout(isOutGoingMessage: isOutgoing ?? true,
                                               isNeedShowTime: needShowTime,
                                            bubbleContentSize: imgSize,
                                          bubbleContentInsets: UIEdgeInsets.zero,
                                         timeLabelContentSize: timeContentSize,
                                                         type: RCTMessageModel.kMsgTypeImage)
      }
      
      if typeString == RCTMessageModel.kMsgTypeVoice {
        messageLayout = MyMessageCellLayout(isOutGoingMessage: isOutgoing ?? true,
                                               isNeedShowTime: needShowTime,
                                            bubbleContentSize: CGSize(width: 80, height: 37),
                                          bubbleContentInsets: UIEdgeInsets.zero,
                                         timeLabelContentSize: timeContentSize,
                                                         type: RCTMessageModel.kMsgTypeVoice)
      }
      
      if typeString == RCTMessageModel.kMsgTypeVideo {

        messageLayout = MyMessageCellLayout(isOutGoingMessage: isOutgoing ?? true,
                                               isNeedShowTime: needShowTime,
                                            bubbleContentSize: CGSize(width: 120, height: 160),
                                          bubbleContentInsets: UIEdgeInsets.zero,
                                         timeLabelContentSize: timeContentSize,
                                                         type: RCTMessageModel.kMsgTypeVideo)
      }
      
      if typeString == RCTMessageModel.kMsgTypeCustom {
        // TODO custom
        text = messageDic.object(forKey: RCTMessageModel.kMsgKeyContent) as? String
        var bubbleContentSize = CGSize.zero
        var contentSize = messageDic.object(forKey: RCTMessageModel.kMsgKeyContentSize) as? NSDictionary
        if let _ = contentSize {
          let contentWidth = contentSize!["width"] as! NSNumber
          let contentHeight = contentSize!["height"] as! NSNumber
          bubbleContentSize = CGSize(width: contentWidth.doubleValue, height: contentHeight.doubleValue)
        } else {
          bubbleContentSize = CGSize.zero
        }
        messageLayout = MyMessageCellLayout(isOutGoingMessage: isOutgoing ?? true,
                                               isNeedShowTime: needShowTime,
                                            bubbleContentSize: bubbleContentSize,
                                          bubbleContentInsets: UIEdgeInsets.zero,
                                         timeLabelContentSize: timeContentSize,
                                                         type: RCTMessageModel.kMsgTypeCustom)
      }
    }
    
    var msgStatus = IMUIMessageStatus.success
    if let statusString = statusString {
      
      if statusString == RCTMessageModel.kMsgStatusSuccess {
        msgStatus = .success
      }
      
      if statusString == RCTMessageModel.kMsgStatusFail {
        msgStatus = .failed
      }
      
      if statusString == RCTMessageModel.kMsgStatusSending {
        msgStatus = .sending
      }
      
      if statusString == RCTMessageModel.kMsgStatusDownloadFail {
        msgStatus = .mediaDownloadFail
      }
      
      if statusString == RCTMessageModel.kMsgStatusDownloading {
        msgStatus = .mediaDownloading
      }
      
    }
    
    self.init(msgId: msgId, messageStatus: msgStatus, fromUser: user, isOutGoing: isOutgoing ?? true, time: timeString!, type: msgType!, text: text!, mediaPath: mediaPath!,imageUrl: imgUrl, layout:  messageLayout!,duration: durationTime, extras: extras)

  }
  
  override open func text() -> String {
    return self.myTextMessage
  }
  
  @objc static func calculateTextContentSize(text: String, isOutGoing: Bool) -> CGSize {
    if isOutGoing {
      return text.sizeWithConstrainedWidth(with: IMUIMessageCellLayout.bubbleMaxWidth,
                                    font: IMUITextMessageContentVie
```

### Core Architecture Module: `ReactNative/ios/RCTAuroraIMUI/MyUser.swift`
```
//
//  MyUser.swift
//  IMUIChat
//
//  Created by oshumini on 2017/4/9.
//  Copyright © 2017年 HXHG. All rights reserved.
//

import Foundation
import UIKit

open class RCTUser: NSObject, IMUIUserProtocol {
  open var rUserId: String?
  open var rDisplayName: String?
  open var rAvatarFilePath: String?
  open var rAvatarUrl: String?
  public override init() {
    super.init()
  }
  
  @objc convenience init(userDic: NSDictionary) {
    self.init()
    self.rUserId = userDic.object(forKey: "userId") as? String
    self.rDisplayName = userDic.object(forKey: "displayName") as? String
    self.rAvatarFilePath = userDic.object(forKey: "avatarPath") as? String
    if FileManager.default.fileExists(atPath: self.rAvatarFilePath ?? "") {
      
    } else {
      self.rAvatarUrl = self.rAvatarFilePath
      self.rAvatarFilePath = ""
    }
    
  }
  
  public func userId() -> String {
    if let rUserId = self.rUserId {
      return rUserId
    } else {
      return ""
    }
  }
  
  public func displayName() -> String {
    if let rDisplayName = self.rDisplayName {
      return rDisplayName
    } else {
      return ""
    }
  }
  
  public func Avatar() -> UIImage {
    if let path = self.rAvatarFilePath {
      let fileManager = FileManager.default
      if fileManager.fileExists(atPath: path) {
        return UIImage(contentsOfFile: path)!
      }
    }
    return UIImage()
  }
  
  public func avatarUrlString() -> String? {
    return self.rAvatarUrl
  }
}

```

### Core Architecture Module: `ReactNative/ios/RCTAuroraIMUI/RCTAuroraIMUI-Bridging-Header.h`
```
//
//  RCTAuroraIMUI-Bridging-Header.h
//  RCTAuroraIMUI
//
//  Created by oshumini on 2017/5/27.
//  Copyright © 2017年 HXHG. All rights reserved.
//

#if __has_include(<React/RCTBridgeModule.h>)
#import <React/RCTBridgeModule.h>
#elif __has_include("RCTBridgeModule.h")
#import "RCTBridgeModule.h"
#elif __has_include("React/RCTBridgeModule.h")
#import "React/RCTBridgeModule.h"
#endif

```

### Core Architecture Module: `ReactNative/ios/RCTAuroraIMUI/RCTAuroraIMUI.h`
```
//
//  RCTAuroraIMUI.h
//  RCTAuroraIMUI
//
//  Created by oshumini on 2017/6/5.
//  Copyright © 2017年 HXHG. All rights reserved.
//

#import <UIKit/UIKit.h>

//! Project version number for RCTAuroraIMUI.
FOUNDATION_EXPORT double RCTAuroraIMUIVersionNumber;

//! Project version string for RCTAuroraIMUI.
FOUNDATION_EXPORT const unsigned char RCTAuroraIMUIVersionString[];

// In this header, you should import all the public headers of your framework using statements like #import <RCTAuroraIMUI/PublicHeader.h>



```

### Core Architecture Module: `ReactNative/ios/RCTAuroraIMUI/RCTAuroraIMUIFileManager.h`
```
//
//  RCTAuroraIMUIFileManager.h
//  RCTAuroraIMUI
//
//  Created by oshumini on 2018/3/6.
//  Copyright © 2018年 HXHG. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface RCTAuroraIMUIFileManager : NSObject
+ (NSString *)getPath;
+ (void)createDirectory:(NSString *)directoryName atFilePath:(NSString *)filePath;
+ (int)getFileSize:(NSString *)path;
@end

```

### Core Architecture Module: `ReactNative/ios/RCTAuroraIMUI/RCTAuroraIMUIModule.h`
```
//
//  RCTAuroraIMUIModule.h
//  RCTAuroraIMUI
//
//  Created by oshumini on 2017/6/1.
//  Copyright © 2017年 HXHG. All rights reserved.
//
#import <Foundation/Foundation.h>

#if __has_include(<React/RCTBridgeModule.h>)
#import <React/RCTBridgeModule.h>
#import <React/RCTEventDispatcher.h>
#elif __has_include("RCTBridgeModule.h")
#import "RCTBridgeModule.h"
#import "RCTEventDispatcher.h"
#elif __has_include("React/RCTBridgeModule.h")
#import "React/RCTEventDispatcher.h"
#import "React/RCTBridgeModule.h"
#endif

#define kAppendMessages @"kAppendMessage"
#define kRemoveMessage @"kRemoveMessage"
#define kRemoveAllMessages @"kRemoveAllMessages"
#define kInsertMessagesToTop @"kInsertMessagesToTop"
#define kUpdateMessge @"kUpdateMessge"
#define kScrollToBottom @"kScrollToBottom"
#define kScrollToBottom @"kScrollToBottom"
#define kHidenFeatureView @"kHidenFeatureView"
#define kMessageListDidLoad @"kMessageListDidLoad"
#define kLayoutInputView @"kLayoutInputView"

@interface RCTAuroraIMUIModule : NSObject <RCTBridgeModule>
+ (NSString *)getPath;
@end

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #403** (2018-08-13): **【BUG】点击拍照按钮，会触发三次 onTakePicture**
  *Symptoms*: ### My environment:  - `react-native` version: 0.55.4 - `aurora-imui-react-native` version: 0.10.4  sample 的代码执行也是这样的。  ![image](https://user-images.githubusercontent.com/13204332/42500957-32e03728-8465-11e8-8e5d-613680a405f4.png)  ![20180710_171836](https://user-images.githubusercontent.com/13204332/42500993-4bf2e76a-8465-11e8-9a40-df99b5618585.png) 
  **Post-Mortem & Fix Analysis**:
  > 对的，就是安卓下面的。iOS暂时没有测试
  > 您在测试这个BUG吗？如果暂时不修复的话，我可以禁用这个视频拍摄的功能吗？
  > ![20180710_174033](https://user-images.githubusercontent.com/13204332/42502351-5d2722be-8468-11e8-850f-bb0bbc5ed900.png) 这是实际的，可以看到三张是一模一样的

- **Issue #119** (2017-11-16): **React Native ios and android onPullToRefresh bug**
  *Symptoms*:    - `react-native` version:最新  - `aurora-imui-react-native` version:最新  ios 不手动刷新第一次进界面不会调用onPullToRefresh ，可之后每次再进界面会触发onPullToRefresh，很奇怪的问题，这样会导致分页加载聊天记录出现问题。  android 下拉刷新没有进度条，无法手动刷新触发，偶尔才能触发一次出来，   
  **Post-Mortem & Fix Analysis**:
  > 下个版本中修复这个问题

- **Issue #101** (2017-08-24): **RN DEMO android聊天列表发送内容后不刷新的问题**
  *Symptoms*: iOS正常每次发送消息都会弹出，android发送后界面无变化，只有用手势上啦一下或者软键盘放下去的时候，才能看到刚发出的消息，不知道什么原因
  **Post-Mortem & Fix Analysis**:
  > 之前有人提了同样的 issue  #61 ，先关闭这个。

- **Issue #84** (2017-08-01): **发送消息出错**
  *Symptoms*: 代码我是拷贝的ios示例里的，没改一行代码。发送消息时提示 undefined is not an object(evaluating 'AuroralController.appendMessages') 界面显示正常，点图片，相机程序直接退出，录入文字点发送报上面的错。 也就是NativeModules.RNTAuroraIController未取到，不知道是哪方面的原因
  **Post-Mortem & Fix Analysis**:
  > 这个模块名在新的版本中改了，没来得及更新 demo 这是抱歉,可以使用新的模块名  ``` NativeModules.AuroraIMUIModule ```
  > @huangminlinux  感谢这些及时回复，用了这个是不会提示undefined了 但是现在一点就黑屏退出，不知道是什么原因
  > 我也碰到同样的问题 发送文字的时候黑屏 然后闪退

- **Issue #76** (2017-08-18): **React Native 布局错误，奔溃没有提示**
  *Symptoms*: 最新版本与0.3.2版本编译不过， 0.3.0编译成功 inputView 点击图片 ![img_0813](https://user-images.githubusercontent.com/18651571/28015953-eafb9270-65a4-11e7-87d9-9b0878633abc.PNG) inputView 点击语音 ![img_0814](https://user-images.githubusercontent.com/18651571/28015942-de4f07c8-65a4-11e7-932a-b5592607f217.PNG) inputView 点击相册 ![image](https://user-images.githubusercontent.com/18651571/28015980-0c28e970-65a5-11e7-988d-5fb3593b2bcf.png) 然后......点击发送任何消息..无任何提示闪退   
  **Post-Mortem & Fix Analysis**:
  > RN0.44.3 run 0.30.0
  > 当前最新版本是 0.4.3，建议更新到 0.4.3
  > @huangminlinux 首次集成是0.4.3，ios 与android都出现bug，我再次尝试0.4.3版本希望编译顺利

- **Issue #63** (2017-08-18): **dev 分支的 RN sample 无法运行**
  *Symptoms*: ![image](https://user-images.githubusercontent.com/2732303/27763623-3fb062e8-5eb9-11e7-99e5-ad1b2bb89021.png)  按文档所述，我先编译 aurora-imui framework，但是报错了，是哪里操作错误么
  **Post-Mortem & Fix Analysis**:
  > 我新拉下来是没有问题的， IMUI 用的是 0.4.2 版本。
  > 升级 xcode 到最新版本，先关闭这个 issue 如果还有问题可以重新打开。

- **Issue #62** (2017-07-10): **nullpointerException**
  *Symptoms*:    ![qq 20170629160212](https://user-images.githubusercontent.com/16317348/27678109-93549b8c-5ce6-11e7-9d6e-3d241ff74c6d.png) 
  **Post-Mortem & Fix Analysis**:
  > dev 上修复了，这个星期发布新版本。
  > 蟹蟹
  > @smarthityou 更新了

- **Issue #61** (2017-08-25): **点击发送消息后，聊天列表不会更新，必须要手动滑一下才会更新，这是为什么呢？**
  *Symptoms*: 点击发送消息后，聊天列表不会更新，必须要手动滑一下才会更新，这是为什么呢？
  **Post-Mortem & Fix Analysis**:
  > 是不是你布局问题啊
  > @Jorble 你有没有出现这个问题？
  > 发送第一张图片的时候有时候会，后面基本都会自动显示最后一条的。可能是你布局遮住了吧。

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

### Incident Patch 1: `7794feb3` (2019-06-17)
**Commit Message**: fix inputview crash bug

**File**: `iOS/IMUIInputView/Controllers/IMUICustomInputView.swift` (modified, +3/-1)
```diff
@@ -181,7 +181,9 @@ open class IMUICustomInputView: UIView {
       }
     }
     
-    self.superview?.layoutIfNeeded()
+    DispatchQueue.main.async {
+        self.superview?.layoutIfNeeded()
+    }
   }
   
   func fitTextViewSize(_ textView: UITextView) {
```

---

### Incident Patch 2: `8c0c5e2c` (2019-03-08)
**Commit Message**: Fix send picture bug.

**File**: `Android/sample/exampleui/src/main/java/imui/jiguang/cn/imuisample/messages/MessageListActivity.java` (modified, +2/-1)
```diff
@@ -134,7 +134,8 @@ public void onSendFiles(List<FileItem> list) {
                 if (list == null || list.isEmpty()) {
                     return;
                 }
-
+                // should reset messageList height
+                mChatView.setMsgListHeight(true);
                 MyMessage message;
                 for (FileItem item : list) {
                     if (item.getType() == FileItem.Type.Image) {
```

**File**: `Android/sample/exampleui/src/main/java/imui/jiguang/cn/imuisample/views/ChatView.java` (modified, +5/-0)
```diff
@@ -181,6 +181,11 @@ public ImageButton getSelectAlbumBtn() {
         return this.mSelectAlbumIb;
     }
 
+    /**
+     * reset MessageList's height, so that switch to SoftInput or Menu
+     * wouldn't cause MessageList scroll
+     * @param isTouchMsgList if touch MessageList, reset MessageList's height.
+     */
     public void setMsgListHeight(boolean isTouchMsgList) {
         if (!isTouchMsgList) {
             ViewGroup.LayoutParams layoutParams = mMsgList.getLayoutParams();
```

---

### Incident Patch 3: `38dea7e2` (2019-03-08)
**Commit Message**: Merge branch 'dev' of github.com:jpush/imui into dev

**File**: `iOS/IMUIInputView/Views/IMUICameraCell.swift` (modified, +15/-8)
```diff
@@ -51,7 +51,9 @@ class IMUICameraCell: UICollectionViewCell, IMUIFeatureCellProtocol {
     }
     
     cameraView.shootPictureCallback = { imageData in
-      self.featureDelegate?.didShotPicture(with: imageData)
+      DispatchQueue.main.async {
+        self.featureDelegate?.didShotPicture(with: imageData)
+      }
       if self.isFullScreenMode {
         // Switch to main thread operation UI
         DispatchQueue.main.async {
@@ -79,17 +81,22 @@ class IMUICameraCell: UICollectionViewCell, IMUIFeatureCellProtocol {
     let rootVC = UIApplication.shared.delegate?.window??.rootViewController
     self.cameraView.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: UIScreen.main.bounds.height)
     self.cameraVC.view = self.cameraView
-    
-    rootVC?.present(self.cameraVC, animated: true, completion: {} )
+    DispatchQueue.main.async {
+      rootVC?.present(self.cameraVC, animated: true, completion: {} )
+    }
   }
   
   func shrinkDownScreen() {
+    
     self.featureDelegate?.cameraRecoverScreen()
-    self.cameraVC.dismiss(animated: false, completion: {
-      print("\(self.contentView)")
-      self.contentView.addSubview(self.cameraView)
-      self.cameraView.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 253)
-    })
+    DispatchQueue.main.async {
+      self.cameraVC.dismiss(animated: false, completion: {
+        print("\(self.contentView)")
+        self.contentView.addSubview(self.cameraView)
+        self.cameraView.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 253)
+      })
+    }
+    
   }
   
   func activateMedia() {
```

**File**: `iOS/IMUIInputView/Views/IMUICameraView.swift` (modified, +4/-4)
```diff
@@ -410,6 +410,7 @@ class IMUICameraView: UIView {
   // -MARK: Click Event
   @IBAction func clickCameraSwitch(_ sender: Any) {
     if isPhotoMode {
+      
       if #available(iOS 10.0, *) {
         self.capturePhotoAfter_iOS10()
       } else {
@@ -528,8 +529,7 @@ class IMUICameraView: UIView {
       }
       
       let photoSettings = AVCapturePhotoSettings()
-      photoSettings.flashMode = .auto
-      
+      photoSettings.flashMode = .auto  
       photoSettings.isHighResolutionPhotoEnabled = false
       
       if photoSettings.availablePreviewPhotoPixelFormatTypes.count > 0 {
@@ -580,6 +580,7 @@ class IMUICameraView: UIView {
         }
       )
       
+
   self.inProgressPhotoCaptureDelegates[photoCaptureDelegate.requestedPhotoSettings.uniqueID] = photoCaptureDelegate
 
       switch self.currentCameraDeviceType {
@@ -591,8 +592,7 @@ class IMUICameraView: UIView {
       default:
         break
       }
-      
-      photoSettings.flashMode = .off
+      photoSettings.flashMode = self.videoDeviceInput.device.isFlashAvailable ? .auto : .off
 
       self.photoOutput?.capturePhoto(with: photoSettings, delegate: photoCaptureDelegate)
     }
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "aurora-imui-react-native",
-    "version": "0.13.1",
+    "version": "0.14.0",
     "description": "aurora imui plugin for react native application",
     "main": "index.js",
 
```

---

### Incident Patch 4: `bc25bba8` (2019-03-08)
**Commit Message**: Fix switch menu to SoftInput cause MessageList scrolls.

**File**: `Android/messagelist/src/main/java/cn/jiguang/imui/messages/MessageList.java` (modified, +15/-0)
```diff
@@ -7,6 +7,7 @@
 import android.support.v7.widget.RecyclerView;
 import android.support.v7.widget.SimpleItemAnimator;
 import android.util.AttributeSet;
+import android.util.Log;
 import android.view.GestureDetector;
 import android.view.MotionEvent;
 
@@ -20,6 +21,7 @@ public class MessageList extends RecyclerView implements GestureDetector.OnGestu
     private final GestureDetector mGestureDetector;
     private MsgListAdapter mAdapter;
     private ScrollMoreListener mScrollMoreListener;
+    private int mMaxHeight;
 
     public MessageList(Context context) {
         this(context, null);
@@ -297,4 +299,17 @@ public void run() {
             layout(getLeft(), getTop(), getRight(), getBottom());
         }
     };
+
+    @Override
+    protected void onLayout(boolean changed, int l, int t, int r, int b) {
+        super.onLayout(changed, l, t, r, b);
+        Log.d("ChatView", "onLayout height = " + b);
+        if (mMaxHeight == 0) {
+            mMaxHeight = b;
+        }
+    }
+
+    public int getMaxHeight() {
+        return mMaxHeight;
+    }
 }
```

**File**: `Android/sample/exampleui/src/main/java/imui/jiguang/cn/imuisample/messages/MessageListActivity.java` (modified, +2/-0)
```diff
@@ -681,6 +681,7 @@ public void run() {
     }
 
     private void scrollToBottom() {
+        mChatView.setMsgListHeight(false);
         new Handler().postDelayed(new Runnable() {
             @Override
             public void run() {
@@ -697,6 +698,7 @@ public boolean onTouch(View view, MotionEvent motionEvent) {
                 if (chatInputView.getMenuState() == View.VISIBLE) {
                     chatInputView.dismissMenuLayout();
                 }
+                mChatView.setMsgListHeight(true);
                 try {
                     View v = getCurrentFocus();
                     if (mImm != null && v != null) {
```

**File**: `Android/sample/exampleui/src/main/java/imui/jiguang/cn/imuisample/views/ChatView.java` (modified, +18/-0)
```diff
@@ -3,7 +3,9 @@
 import android.content.Context;
 import android.support.v7.widget.RecyclerView;
 import android.util.AttributeSet;
+import android.util.Log;
 import android.view.View;
+import android.view.ViewGroup;
 import android.widget.ImageButton;
 import android.widget.LinearLayout;
 import android.widget.RelativeLayout;
@@ -178,4 +180,20 @@ public MessageList getMessageListView() {
     public ImageButton getSelectAlbumBtn() {
         return this.mSelectAlbumIb;
     }
+
+    public void setMsgListHeight(boolean isTouchMsgList) {
+        if (!isTouchMsgList) {
+            ViewGroup.LayoutParams layoutParams = mMsgList.getLayoutParams();
+            int height = mChatInput.getSoftKeyboardHeight();
+            if (height > 0) {
+                layoutParams.height = mChatInput.getSoftKeyboardHeight();
+                mMsgList.setLayoutParams(layoutParams);
+            }
+        } else {
+            ViewGroup.LayoutParams layoutParams = mMsgList.getLayoutParams();
+            layoutParams.height = mMsgList.getMaxHeight();
+            Log.d("ChatView", "set MessageList height, height = " + layoutParams.height);
+            mMsgList.setLayoutParams(layoutParams);
+        }
+    }
 }
```

---

### Incident Patch 5: `1554e048` (2019-03-01)
**Commit Message**: update to 0.14.0 aurora-imui-react-native

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "aurora-imui-react-native",
-    "version": "0.13.1",
+    "version": "0.14.0",
     "description": "aurora imui plugin for react native application",
     "main": "index.js",
 
```

---

### Incident Patch 6: `2f155d0a` (2019-03-01)
**Commit Message**: update fix do not have camera flash take picture crash bug

**File**: `iOS/IMUIInputView/Views/IMUICameraCell.swift` (modified, +15/-8)
```diff
@@ -51,7 +51,9 @@ class IMUICameraCell: UICollectionViewCell, IMUIFeatureCellProtocol {
     }
     
     cameraView.shootPictureCallback = { imageData in
-      self.featureDelegate?.didShotPicture(with: imageData)
+      DispatchQueue.main.async {
+        self.featureDelegate?.didShotPicture(with: imageData)
+      }
       if self.isFullScreenMode {
         // Switch to main thread operation UI
         DispatchQueue.main.async {
@@ -79,17 +81,22 @@ class IMUICameraCell: UICollectionViewCell, IMUIFeatureCellProtocol {
     let rootVC = UIApplication.shared.delegate?.window??.rootViewController
     self.cameraView.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: UIScreen.main.bounds.height)
     self.cameraVC.view = self.cameraView
-    
-    rootVC?.present(self.cameraVC, animated: true, completion: {} )
+    DispatchQueue.main.async {
+      rootVC?.present(self.cameraVC, animated: true, completion: {} )
+    }
   }
   
   func shrinkDownScreen() {
+    
     self.featureDelegate?.cameraRecoverScreen()
-    self.cameraVC.dismiss(animated: false, completion: {
-      print("\(self.contentView)")
-      self.contentView.addSubview(self.cameraView)
-      self.cameraView.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 253)
-    })
+    DispatchQueue.main.async {
+      self.cameraVC.dismiss(animated: false, completion: {
+        print("\(self.contentView)")
+        self.contentView.addSubview(self.cameraView)
+        self.cameraView.frame = CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 253)
+      })
+    }
+    
   }
   
   func activateMedia() {
```

**File**: `iOS/IMUIInputView/Views/IMUICameraView.swift` (modified, +4/-4)
```diff
@@ -410,6 +410,7 @@ class IMUICameraView: UIView {
   // -MARK: Click Event
   @IBAction func clickCameraSwitch(_ sender: Any) {
     if isPhotoMode {
+      
       if #available(iOS 10.0, *) {
         self.capturePhotoAfter_iOS10()
       } else {
@@ -528,8 +529,7 @@ class IMUICameraView: UIView {
       }
       
       let photoSettings = AVCapturePhotoSettings()
-      photoSettings.flashMode = .auto
-      
+      photoSettings.flashMode = .auto  
       photoSettings.isHighResolutionPhotoEnabled = false
       
       if photoSettings.availablePreviewPhotoPixelFormatTypes.count > 0 {
@@ -580,6 +580,7 @@ class IMUICameraView: UIView {
         }
       )
       
+
   self.inProgressPhotoCaptureDelegates[photoCaptureDelegate.requestedPhotoSettings.uniqueID] = photoCaptureDelegate
 
       switch self.currentCameraDeviceType {
@@ -591,8 +592,7 @@ class IMUICameraView: UIView {
       default:
         break
       }
-      
-      photoSettings.flashMode = .off
+      photoSettings.flashMode = self.videoDeviceInput.device.isFlashAvailable ? .auto : .off
 
       self.photoOutput?.capturePhoto(with: photoSettings, delegate: photoCaptureDelegate)
     }
```

---

### Incident Patch 7: `275cbf33` (2019-02-12)
**Commit Message**: Fix bugs

**File**: `ReactNative/chatinput.android.js` (modified, +1/-0)
```diff
@@ -267,6 +267,7 @@ ChatInput.propTypes = {
   hideVoiceButton: PropTypes.bool,
   hideEmojiButton: PropTypes.bool,
   hidePhotoButton: PropTypes.bool,
+  customLayoutItems: PropTypes.object,
   cameraQuality: PropTypes.number,
   ...ViewPropTypes
 };
```

---

### Incident Patch 8: `7c194b69` (2019-01-09)
**Commit Message**: Set android.hardware.camera2 unrequired

**File**: `Android/chatinput/src/main/AndroidManifest.xml` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     <uses-permission android:name="android.permission.RECORD_AUDIO"/>
     <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
     <uses-feature android:name="android.hardware.camera" />
-    <uses-feature android:name="android.hardware.camera2" />
+    <uses-feature android:name="android.hardware.camera2" android:required="false" />
 
     <application
         android:allowBackup="true"
```

---

### Incident Patch 9: `7ae4c94d` (2019-01-09)
**Commit Message**: Fix Preview Distortion

**File**: `Android/chatinput/src/main/java/cn/jiguang/imui/chatinput/camera/CameraNew.java` (modified, +72/-46)
```diff
@@ -39,8 +39,11 @@
 import android.util.Log;
 import android.util.Size;
 import android.util.SparseIntArray;
+import android.view.Gravity;
 import android.view.Surface;
 import android.view.TextureView;
+import android.view.ViewGroup;
+import android.widget.FrameLayout;
 import android.widget.Toast;
 
 import java.io.File;
@@ -154,9 +157,9 @@ public class CameraNew implements CameraSupport {
     private Handler mBackgroundHandler;
     private int mWidth;
     private int mHeight;
+    private float mCameraQuality;
     private static SparseIntArray ORIENTATIONS = new SparseIntArray();
     private static SparseIntArray INVERSE_ORIENTATIONS = new SparseIntArray();
-    private CameraCharacteristics mCameraCharacteristic;
     private static boolean mIsTakingPicture = false;
     /**
      * An {@link ImageReader} that handles still image capture.
@@ -298,7 +301,7 @@ public void setCameraEventListener(CameraEventListener listener) {
     }
 
     @Override
-    public CameraSupport open(final int cameraId, int width, int height, boolean isFacingBack) {
+    public CameraSupport open(final int cameraId, int width, int height, boolean isFacingBack,float cameraQuality) {
         if (ActivityCompat.checkSelfPermission(mContext, Manifest.permission.CAMERA)
                 != PackageManager.PERMISSION_GRANTED && ActivityCompat.checkSelfPermission(mContext,
                 Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
@@ -310,6 +313,7 @@ public CameraSupport open(final int cameraId, int width, int height, boolean isF
         mHeight = height;
         mIsFacingBack = isFacingBack;
         mCameraId = cameraId + "";
+        mCameraQuality = cameraQuality;
         startBackgroundThread();
         setUpCameraOutputs(width, height);
         configureTransform(width, height);
@@ -424,37 +428,63 @@ private Size chooseVideoSize(Size[] choices) {
      *
      * @param sizes           The list of sizes that the camera supports for the intended output
      *                          class
-     * @param width  The width of the texture view relative to sensor coordinate
-     * @param height The height of the texture view relative to sensor coordinate
+     * @param w  The width of the texture view relative to sensor coordinate
+     * @param h The height of the texture view relative to sensor coordinate
      * @return The optimal {@code Size}, or an arbitrary one if none were big enough
      */
-    private static Size chooseOptimalSize(Size[] sizes, int width,
-                                          int height) {
+    private static Size chooseOptimalSize(Size[] sizes, int w,
+                                          int h) {
 
-        List<Size> collectorSizes = new ArrayList<>();
-        for (Size option : sizes) {
-            if (option.getWidth() == width && option.getHeight() == height) {
-                return option;
-            }
-            if (width > height) {
-                if (option.getWidth() > width && option.getHeight() > height) {
-                    collectorSizes.add(option);
-                }
-            } else {
-                if (option.getHeight() > width && option.getWidth() > height) {
-                    collectorSizes.add(option);
-                }
+//        List<Size> collectorSizes = new ArrayList<>();
+//        for (Size option : sizes) {
+//            if (option.getWidth() == width && option.getHeight() == height) {
+//                return option;
+//            }
+//            if (width > height) {
+//                if (option.getWidth() > width && option.getHeight() > height) {
+//                    collectorSizes.add(option);
+//                }
+//            } else {
+//                if (option.getHeight() > width && option.getWidth() > height) {
+//                    collectorSizes.add(option);
+//                }
+//            }
+//        }
+//        if (collectorSizes.size() > 0) {
+//            return Collections.min(collectorSizes, new Comparator<Size>() {
+//                @Override
+//                public int compare(Size s1, Size s2) {
+//                    return Long.signum(s1.getWidth() * s1.getHeight() - s2.getWidth() * s2.getHeight());
+//                }
+//            });
+//        }
+//        return sizes[0];
+        final double ASPECT_TOLERANCE = 0.1;
+        double targetRatio = (double) w / h;
+        if (sizes == null) return null;
+        Size optimalSize = null;
+        double minDiff = Double.MAX_VALUE;
+        int targetHeight = h;
+        // Try to find an size match aspect ratio and size
+        for (Size size : sizes) {
+            double ratio = (double) size.getWidth() / size.getHeight();
+            if (Math.abs(ratio - targetRatio) > ASPECT_TOLERANCE) continue;
+            if (Math.abs(size.getHeight() - targetHeight) < minDiff) {
+                optimalSize = size;
+                minDiff = Math.abs(size.getHeight() - targetHeight);
             }
 
```

---

### Incident Patch 10: `4d21aede` (2019-01-09)
**Commit Message**: Merge branch 'dev' of https://github.com/jpush/aurora-imui into dev

**File**: `Android/chatinput/src/main/java/cn/jiguang/imui/chatinput/ChatInputView.java` (modified, +1/-1)
```diff
@@ -1191,7 +1191,7 @@ public void onAnimationEnd(Animator animator) {
                 if (hasContent) {
                     mSendBtn.setImageDrawable(ContextCompat.getDrawable(getContext(), mStyle.getSendBtnPressedIcon()));
                 } else {
-                    mSendBtn.setImageDrawable(ContextCompat.getDrawable(getContext(), R.drawable.aurora_menuitem_send));
+                    mSendBtn.setImageDrawable(ContextCompat.getDrawable(getContext(), mStyle.getSendBtnIcon()));
                 }
                 restoreAnimatorSet.start();
             }
```

**File**: `Android/chatinput/src/main/java/cn/jiguang/imui/chatinput/utils/SimpleCommonUtils.java` (modified, +1/-1)
```diff
@@ -160,7 +160,7 @@ public View instantiateItem(ViewGroup container, int position, EmoticonPageEntit
                     pageView.setNumColumns(pageEntity.getRow());
                     pageEntity.setRootView(pageView);
                     try {
-                        EmoticonsAdapter adapter = (EmoticonsAdapter) newInstance(_class, container.getContext(), pageEntity, onEmoticonClickListener);
+                        EmoticonsAdapter adapter = new EmoticonsAdapter(container.getContext(), pageEntity, onEmoticonClickListener);
                         if (emoticonDisplayListener != null) {
                             adapter.setOnDisPlayListener(emoticonDisplayListener);
                         }
```

---

### Incident Patch 11: `bd0cd3d9` (2018-12-18)
**Commit Message**: udpate aurora-imui-react-native to 0.12.7

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
     "name": "aurora-imui-react-native",
-    "version": "0.12.6",
+    "version": "0.12.7",
     "description": "aurora imui plugin for react native application",
     "main": "index.js",
 
```

---

### Incident Patch 12: `c943ee84` (2018-12-18)
**Commit Message**: fix iOS swift -  feature set none when do not select feature item

**File**: `ReactNative/sample/ios/TestRNIMUI.xcodeproj/xcshareddata/xcschemes/TestRNIMUI.xcscheme` (modified, +0/-2)
```diff
@@ -54,7 +54,6 @@
       buildConfiguration = "Debug"
       selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
       selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
-      language = ""
       shouldUseLaunchSchemeArgsEnv = "YES">
       <Testables>
          <TestableReference
@@ -84,7 +83,6 @@
       buildConfiguration = "Debug"
       selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
       selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
-      language = ""
       launchStyle = "0"
       useCustomWorkingDirectory = "NO"
       ignoresPersistentStateOnLaunch = "NO"
```

**File**: `iOS/IMUICommon/Extension/UIColorExtension.swift` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ public extension UIColor {
       cString.remove(at: cString.startIndex)
     }
     
-    if ((cString.characters.count) != 6) {
+    if ((cString.count) != 6) {
       return UIColor.gray
     }
     
```

**File**: `iOS/IMUIInputView/Controllers/IMUICustomInputView.swift` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@ open class IMUICustomInputView: UIView {
   override public init(frame: CGRect) {
     super.init(frame: frame)
     let bundle = Bundle.imuiInputViewBundle()
-    view = bundle.loadNibNamed("IMUICustomInputView", owner: self, options: nil)?.first as! UIView
+    view = bundle.loadNibNamed("IMUICustomInputView", owner: self, options: nil)?.first as? UIView
     
     self.addSubview(view)
     view.frame = self.bounds
```

**File**: `iOS/IMUIInputView/Controllers/IMUIInputView.swift` (modified, +1/-0)
```diff
@@ -259,6 +259,7 @@ open class IMUIInputView: IMUICustomInputView {
   }
   
   fileprivate func switchToFeature(type: IMUIFeatureType, button: UIButton) {
+    self.featureView.layoutFeature(with: type)
     switch type {
     case .voice:
       self.delegate?.switchToMicrophoneMode?(recordVoiceBtn: button)
```

**File**: `iOS/IMUIInputView/Views/IMUICameraView.swift` (modified, +4/-5)
```diff
@@ -95,7 +95,7 @@ class IMUICameraView: UIView {
   override init(frame: CGRect) {
     super.init(frame: frame)
     let bundle = Bundle.imuiInputViewBundle()
-    view = bundle.loadNibNamed("IMUICameraView", owner: self, options: nil)?.first as! UIView
+    view = bundle.loadNibNamed("IMUICameraView", owner: self, options: nil)?.first as? UIView
     
     self.addSubview(view)
     view.frame = self.bounds
@@ -105,7 +105,7 @@ class IMUICameraView: UIView {
     super.init(coder: aDecoder)
 
     let bundle = Bundle.imuiInputViewBundle()
-    view = bundle.loadNibNamed("IMUICameraView", owner: self, options: nil)?.first as! UIView
+    view = bundle.loadNibNamed("IMUICameraView", owner: self, options: nil)?.first as? UIView
     
     self.addSubview(view)
     view.frame = self.bounds
@@ -591,9 +591,8 @@ class IMUICameraView: UIView {
       default:
         break
       }
-      if #available(iOS 10.0, *) {
-          photoSettings.flashMode = .off
-      }
+      
+      photoSettings.flashMode = .off
 
       self.photoOutput?.capturePhoto(with: photoSettings, delegate: photoCaptureDelegate)
     }
```

**File**: `iOS/IMUIInputView/Views/IMUIEmojiCell.swift` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ extension IMUIEmojiCell: UICollectionViewDataSource, UICollectionViewDelegate, U
                              cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
     let model = self.emojiDataArr[indexPath.item]
     
-    var cell = collectionView.dequeueReusableCell(withReuseIdentifier: "IMUIEmojiItemCell", for: indexPath) as! IMUIEmojiItemCell
+    let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "IMUIEmojiItemCell", for: indexPath) as! IMUIEmojiItemCell
     cell.layout(with: model)
     return cell
   }
```

**File**: `iOS/IMUIInputView/Views/IMUIFeatureListView.swift` (modified, +1/-23)
```diff
@@ -71,7 +71,7 @@ open class IMUIFeatureListView: UIView {
     super.init(coder: aDecoder)
     
     let bundle = Bundle.imuiBundle()
-    view = bundle.loadNibNamed("IMUIFeatureListView", owner: self, options: nil)?.first as! UIView
+    view = bundle.loadNibNamed("IMUIFeatureListView", owner: self, options: nil)?.first as? UIView
     
     self.addSubview(view)
     view.frame = self.bounds
@@ -126,12 +126,6 @@ open class IMUIFeatureListView: UIView {
     self.featureListCollectionView.register(nib, forCellWithReuseIdentifier: identifier)
   }
   
-  public func updateSendButton(with count: Int?, isAllowToSend: Bool?) {
-//    featureListDataSource.last?.isAllowToSend = isAllowToSend
-//    featureListDataSource.last?.photoCount = count
-//    self.featureListCollectionView.reloadItems(at: [IndexPath(item: featureListDataSource.count - 1, section: 0)])
-  }
-  
   public func reloadData() {
       self.featureListCollectionView.reloadData()
   }
@@ -166,23 +160,7 @@ extension IMUIFeatureListView: UICollectionViewDataSource,UICollectionViewDelega
   
   public func collectionView(_ collectionView: UICollectionView,
                              cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
-//    let cellIdentifier = "IMUIFeatureListIconCell"
-//    let cell = collectionView.dequeueReusableCell(withReuseIdentifier: cellIdentifier, for: indexPath) as! IMUIFeatureListIconCell
-//    cell.layout(with: self.featureListDataSource[indexPath.item],onClickCallback: { cell in
-//      switch cell.featureData!.featureType {
-//        case .none:
-//          self.delegate?.onClickSend?(with: cell)
-//        break
-//        default:
-//          self.delegate?.onSelectedFeature?(with: cell)
-//        break
-//      }
-//    })
-//    return cell
-//        print("fafsdfafafasf")
         return self.dataSource?.imuiInputView(self.featureListCollectionView, self.position!, cellForItemAt: indexPath) ?? UICollectionViewCell()
-    
-//    return UICollectionViewCell()
   }
   
 }
```

**File**: `iOS/IMUIInputView/Views/IMUIFeatureView.swift` (modified, +1/-2)
```diff
@@ -54,7 +54,7 @@ open class IMUIFeatureView: UIView {
     super.init(coder: aDecoder)
     
     let bundle = Bundle.imuiInputViewBundle()
-    view = bundle.loadNibNamed("IMUIFeatureView", owner: self, options: nil)?.first as! UIView
+    view = bundle.loadNibNamed("IMUIFeatureView", owner: self, options: nil)?.first as? UIView
     
     self.addSubview(view)
     view.frame = self.bounds
@@ -144,7 +144,6 @@ open class IMUIFeatureView: UIView {
 // MARK: - UICollectionViewDelegate, UICollectionViewDataSource
 extension IMUIFeatureView: UICollectionViewDelegate, UICollectionViewDataSource, UICollectionViewDelegateFlowLayout {
   public func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
-    return 1
     switch currentType {
     case .none:
       return 0
```

---

### Incident Patch 13: `5ca8bef8` (2018-12-10)
**Commit Message**: aurora-imui-js add props

**File**: `ReactNative_JS/AuroraIMUI.js` (modified, +7/-24)
```diff
@@ -6,7 +6,6 @@ import MessageList from './MessageList'
 import InputView from './InputView'
 import InputItem from './InputItem'
 
-
 export default class AuroraIMUI extends Component {
     constructor(props) {
         super(props)
@@ -240,7 +239,10 @@ AuroraIMUI.propTypes = {
     textInputProps: PropTypes.object,
     maxInputViewHeight: PropTypes.number,// It‘s useful when you want to add a bottom bar in inputView, Usually you need use it to adjust maxInputView's height.
     initialMessages: PropTypes.array,
-
+    stateContainerStyles: PropTypes.object,
+    avatarContainerStyles: PropTypes.object,
+    
+    renderRow: PropTypes.func,
     onInputTextChanged: PropTypes.func,
     onInputViewSizeChanged: PropTypes.func,
     onPullToRefresh: PropTypes.func,
@@ -255,6 +257,8 @@ AuroraIMUI.defaultProps = {
     textInputProps: {},
     initialMessages: [],
     maxInputViewHeight: 120,
+    stateContainerStyles: {},
+    avatarContainerStyles: {},
 
     onInputTextChanged: () => {},
     onInputViewSizeChanged: () => {},
@@ -265,25 +269,4 @@ AuroraIMUI.defaultProps = {
     onStatusViewClick: () => {},
     onMsgContentClick: () => {},
     onMsgContentLongClick: () => {},
-}
-
-// TODO:
-//=== appendMessages
-//- updateMessage
-//- insertMessagesToTop
-//- removeMessage
-//- removeAllMessage
-
-// MessageList
-//- onAvatarClick
-//- onMsgClick
-//- onStatusViewClick
-//- onMsgContentClick
-//- onMsgContentLongClick
-
-
-//- onPullToRefresh
-
-// 
-//- onSendText
-//- onTouchEditText
\ No newline at end of file
+}
\ No newline at end of file
```

**File**: `ReactNative_JS/MessageList.js` (modified, +3/-0)
```diff
@@ -101,6 +101,9 @@ export default class MessageList extends Component {
     >
       <RecyclerListView
         contentContainerStyle={[this.props.messageListStyle ? this.props.messageListStyle : {}]}
+        // set renderAheadOffset 1000000 to disable Recycle row
+        // but waste more memmory, there a bug when set to 2000 ,
+        // insert message on top will scroll to error position.
         renderAheadOffset={1000000}
         ref={(messageListRef) => {this.messageListRef = messageListRef}}
         rowRenderer={this._renderRow} 
```

---

### Incident Patch 14: `9278a82d` (2018-12-10)
**Commit Message**: add aurora-imui-js readme

**File**: `README.md` (modified, +2/-1)
```diff
@@ -56,7 +56,8 @@ Ready components:
 - [IMUIInputView](./docs/iOS/IMUIInputView_usage.md)
 
 ### React Native
-- [AuroraIMUI](./ReactNative/README.md)
+- [AuroraIMUI_native_bridge](./ReactNative/README.md)
+- [AuroraIMUI_Pure_JS](./ReactNative_JS/README.md)
 
 ## Contribute
 
```

---

### Incident Patch 15: `d14cad4b` (2018-12-10)
**Commit Message**: remove aurora-imui js demo src folder

**File**: `ReactNative_JS/example/src/AuroraIMUI.js` (removed, +0/-280)
```diff
@@ -1,280 +0,0 @@
-import React, {Component} from "react";
-import {Platform, View, Dimensions, Text, Image, TouchableHighlight, TextInput,Keyboard, KeyboardAvoidingView} from "react-native";
-import PropTypes from 'prop-types';
-
-import MessageList from "./MessageList";
-import InputView from "./InputView";
-import InputItem from "./InputItem";
-
-
-export default class AuroraIMUI extends Component {
-    constructor(props) {
-        super(props);
-        this.scrollAnimated = false
-        this.state = {
-            extendedState: {ids: []},
-            messageList: props.initialMessages,
-        }
-
-        this.insertMessagesToTop = this.insertMessagesToTop.bind(this);
-        this.appendMessages = this.appendMessages.bind(this);
-        this.updateMessage = this.updateMessage.bind(this)
-        this.removeMessage = this.removeMessage.bind(this)
-
-        this.renderRight = this.renderRight.bind(this);
-        this.renderLeft = this.renderLeft.bind(this);
-        
-        this._onInputViewSizeChanged = this._onInputViewSizeChanged.bind(this);
-        this._messageListScrollToBottom = this._messageListScrollToBottom.bind(this);
-        this._onFocus = this._onFocus.bind(this);
-    }
-
-    componentDidMount() {
-        this.setState({
-            messageList: [...this.state.messageList]
-        }, () => {
-            
-            setTimeout(() => {
-                this.setState({
-                    messageList: [...this.state.messageList]
-                })       
-            }, 50)
-        })
-    }
-    _onInputViewSizeChanged() {
-        if (!this.messageList) {
-            return
-        }
-        
-        this.props.onInputViewSizeChanged && 
-            this.props.onInputViewSizeChanged.constructor === Function &&
-            this.props.onInputViewSizeChanged()
-    }
-
-    insertMessagesToTop(msgArray = []) {
-        if (!this.state.messageList) {
-            return
-        }
-
-        const isNeedKeepCusrrentPosition = this.state.messageList.length > 0
-
-        const newMsgs = msgArray.map((msg) => {
-            return {
-                type: msg.msgType,
-                values: {...msg}
-            }
-        })
-
-        this.state.messageList.unshift(...newMsgs)
-        this.setState(() => {
-            return {
-              messageList: this.state.messageList,
-              extendedState: this.state.extendedState
-            }
-        },
-          () => {
-                if (isNeedKeepCusrrentPosition) {
-                    const topRowIndex = this.messageList.messageListRef.findApproxFirstVisibleIndex();
-                    const currentOffset = this.messageList.messageListRef.getCurrentScrollOffset();
-                    const topRowOffset = this.messageList.messageListRef._virtualRenderer.getLayoutManager().getOffsetForIndex(topRowIndex);
-                    this.messageList.messageListRef._virtualRenderer.getLayoutManager().getOffsetForIndex(topRowIndex);
-                    const diff = currentOffset - topRowOffset.y;
-    
-                    this.messageList.messageListRef._checkAndChangeLayouts(this.messageList.messageListRef.props)
-                    const topRowNewOffset = this.messageList.messageListRef._virtualRenderer.getLayoutManager().getOffsetForIndex(newMsgs.length);
-                    this.messageList.messageListRef.scrollToOffset(0, topRowNewOffset.y + diff);
-                }
-        })
-    }
-
-    appendMessages(msgArray = []) {
-        const newMsgs = msgArray.map((msg) => {
-            return {
-                type: msg.msgType,
-                values: {...msg}
-            }
-        })
-        
-        this.state.messageList.push(...newMsgs)
-        this.setState({
-            messageList: this.state.messageList,
-            extendedState: {ids: []}
-        }, () => {
-            // RecycleListView will excute setTimeout(() => {this.scrollToOffset},0) in componentDidUpdate
-            // So here are add setTimeout to scroll to bottom
-            // It's ugly but work fine
-            setTimeout(() => {
-                this._messageListScrollToBottom(true)
-            }, 20)
-        })
-
-    }
-
-    updateMessage(msg) {
-        if (this.state.messageList) {
-            const index =this.state.messageList.findIndex((item) => msg.msgId === item.values.msgId)
-            this.state.messageList[index] = {type: msg.msgType, values: {...msg}}
-            this.setState({
-                messageList: this.state.messageList
-            })
-        }
-    }
-
-    removeMessage(msg) {
-        if (this.state.messageList) {
-            const index =this.state.messageList.findIndex((item) => msg.msgId === item.values.msgId)
-            this.state.messageList.splice(index, 1)
-            this.setState({
-                messageList: this.state.messageList
-            })
-        }
-    }
-
-    removeAllMessage() {
-        if (this.state.messageList) {
-            this.state.messag
```

**File**: `ReactNative_JS/example/src/Avatar.js` (removed, +0/-59)
```diff
@@ -1,59 +0,0 @@
-import React, {Component} from "react";
-import PropTypes from 'prop-types';
-import { View, ViewPropTypes, Image, StyleSheet, TouchableWithoutFeedback } from 'react-native';
-
-const styles = StyleSheet.create({
-  avatarContainer: {
-    flexDirection: 'column',
-    justifyContent: 'flex-start',
-    alignItems: 'center',
-  },
-  avatar: {
-    width: 40.0,
-    height: 40.0,
-    borderRadius: 20,
-    marginHorizontal: 8.0,
-  }
-})
-
-export default class Avatar extends Component {
-  constructor(props) {
-    super(props)
-    this._onAvatarClick = this._onAvatarClick.bind(this)
-    this._renderAvatarContent = this._renderAvatarContent.bind(this)
-  }
-
-  _renderAvatarContent() {
-
-    if (this.props.avatarContent && 
-        this.props.avatarContent.constructor === Function ) {
-        const avatarContent = this.props.avatarContent({...this.props})
-        if (avatarContent) {
-          return avatarContent
-        }
-    }
-
-    return <View style={{backgroundColor: 'red',width: 40.0,height:40.0}}/>
-  }
-
-  _onAvatarClick() {
-    this.props.onAvatarClick && 
-      this.props.onAvatarClick.constructor === Function &&
-      this.props.onAvatarClick({...this.props})
-  }
-
-  render() {
-    return <TouchableWithoutFeedback
-      onPress={this._onAvatarClick}
-    >
-    <View style={[styles.avatarContainer, this.props.avatarContainerStyles]}>
-      <View
-        style={styles.avatar}
-      >
-      {this._renderAvatarContent()}
-      </View>
-    </View>
-    </TouchableWithoutFeedback>
-  }
-}
-
```

**File**: `ReactNative_JS/example/src/Event.js` (removed, +0/-33)
```diff
@@ -1,33 +0,0 @@
-import React, {Component} from "react";
-import PropTypes from 'prop-types';
-import { View, ViewPropTypes, Text, StyleSheet } from 'react-native';
-
-const styles = StyleSheet.create({
-  eventContainer: {
-    flex: 1,
-    flexDirection: 'row',
-    justifyContent: 'center',
-    marginVertical: 8.0,
-  },
-  event: {
-    paddingVertical: 2.0,
-    paddingHorizontal: 4.0,
-    borderRadius: 4.0,
-    marginHorizontal: 20.0,
-    marginBottom: 8.0,
-    overflow: "hidden",
-    color: 'white',
-    backgroundColor: '#CECECE',
-    fontSize: 11.0,
-  }
-})
-
-export default class Event extends Component {
-  render() {
-    return <View
-      style={styles.eventContainer}
-    >
-      <Text style={styles.event}>{this.props.text}</Text>
-    </View>
-  }
-}
\ No newline at end of file
```

**File**: `ReactNative_JS/example/src/InputItem.js` (removed, +0/-37)
```diff
@@ -1,37 +0,0 @@
-import React, {Component} from "react";
-import PropTypes from 'prop-types';
-import { View, ViewPropTypes, Image, TouchableOpacity, StyleSheet } from 'react-native';
-
-const styles = StyleSheet.create({
-  container: {
-    flex: 1,
-    justifyContent: 'flex-end',
-    alignItems: 'center',
-    padding: 4.0,
-    marginBottom: 6.0
-  },
-  item: {
-    width: 22.0,
-    height: 22.0,
-    marginRight: 4.0,
-  }
-})
-
-export default class InputItem extends Component {
-  render() {
-    return <TouchableOpacity
-      onPress={this.props.onPress}
-      activeOpacity={0.3}
-    >
-      <View
-        style={styles.container}
-      >
-        <Image
-          style={[styles.item, {...this.props.style}]}
-          source={this.props.source}
-        ></Image>
-      </View>
-    </TouchableOpacity>
-  }
-}
-
```

**File**: `ReactNative_JS/example/src/InputView.js` (removed, +0/-189)
```diff
@@ -1,189 +0,0 @@
-import React, {Component} from "react";
-import PropTypes from 'prop-types';
-import { View, ViewPropTypes, StyleSheet, TextInput, Keyboard, Animation } from 'react-native';
-
-const styles = StyleSheet.create({
-  container: {
-    bottom: 0,
-    left: 0,
-    right: 0,
-  },
-  inputView: {
-    flex: 1,
-    flexDirection: 'row',
-    justifyContent: 'center',
-  },
-  textContainer: {
-    flex: 1,
-    backgroundColor: 'white',
-    borderRadius: 4.0,
-    overflow: 'hidden',
-    marginHorizontal: 8.0,
-    marginBottom: 4.0,
-    paddingHorizontal: 4.0,
-  },
-  textInput: {
-    flex: 1,
-    color: '#7487A8',
-    fontSize: 15.0,
-    margin: 0,
-    padding: 0,
-  },
-  rightItem: {
-    width: 30.0,
-    height: 30.0,
-  }
-});
-
-export default class InputView extends Component {
-  constructor(props) {
-    super(props)
-    this.state = {
-      inputViewHeight: undefined,
-      position: "absolute",
-      text: ""
-    }
-
-    this._onContentSizeChange = this._onContentSizeChange.bind(this)
-    this._onFocus = this._onFocus.bind(this)
-    this._onChangeText = this._onChangeText.bind(this)
-  }
-  
-  _onFocus({nativeEvent: event}) {
-
-    if (this.recordCurrentHeight === undefined) {
-      this.setState({
-        inputViewHeight: this.inputViewHeight,
-      })
-    } else {
-      this.setState({
-        inputViewHeight: this.recordCurrentHeight,
-      })
-    }
-
-    this.props.onFocus && 
-      this.props.onFocus.constructor === Function &&
-      this.props.onFocus()
-
-    this.props.onTouchEditText &&
-      this.props.onTouchEditText.constructor === Function &&
-      this.props.onTouchEditText()
-  }
-
-  _onChangeText(newText) {
-    this.setState({
-      text: newText
-    })
-  }
-
-  _onContentSizeChange({nativeEvent: { contentSize: { height } }}) {
-    this.textInputContentHeight = height 
-    
-    if (this.inputViewHeight !== undefined) {
-      if (this.diffHeight === undefined) {
-        this.diffHeight = this.inputViewHeight - this.textInputContentHeight
-      } else {
-        // this.recordCurrentHeight just use to set height when onFocus inputText
-        const maxInputViewHeight = this.props.maxInputViewHeight
-        this.recordCurrentHeight = (this.diffHeight + height) < maxInputViewHeight ? (this.diffHeight + height) : maxInputViewHeight
-        
-        this.setState({
-          inputViewHeight: (this.diffHeight + height) < maxInputViewHeight ? (this.diffHeight + height) : maxInputViewHeight,
-        }, () => {
-          this.props.onInputViewSizeChanged &&
-            this.props.onInputViewSizeChanged.constructor === Function &&
-            this.props.onInputViewSizeChanged()
-        })
-      }
-    }
-  }
-
-  renderTextInput() {
-    
-    if (this.props.renderTextInput &&
-        this.props.renderTextInput.constructor === Function) {
-      return this.props.renderTextInput()
-    }
-    
-    return (
-      <View 
-        style={[styles.textContainer]}
-      >
-        <TextInput 
-          style={[styles.textInput]}
-          maxLength={2000}
-          // multiline={true}
-          enablesReturnKeyAutomatically={true}
-          onContentSizeChange={this._onContentSizeChange}
-          onFocus={this._onFocus}
-          onChangeText={this._onChangeText}
-          value={this.state.text}
-        />
-      </View>
-    );
-  }
-
-  renderLeft() {
-    if (this.props.renderLeft &&
-        this.props.renderLeft.constructor === Function) {
-      return (
-        this.props.renderLeft()
-      );
-    }
-    return null
-  }
-
-  renderRight() {
-    if (this.props.renderRight && 
-        this.props.renderRight.constructor === Function) {
-      return (
-        this.props.renderRight()
-      );
-    }
-
-    return <View style={styles.rightItem}></View>;
-  }
-
-  renderBottom() {
-    if (this.props.renderBottom &&
-        this.props.renderBottom.constructor === Function) {
-        return this.props.renderBottom()
-    }
-
-    return null;
-  }
-
-  render() {
-    return <View
-      style={[
-        styles.container,
-        this.state.inputViewHeight? {height: this.state.inputViewHeight} : {},
-        this.props.inputViewStyle,
-        { position: this.state.position },
-      ]}
-
-      onLayout={({nativeEvent: {layout: {height}}}) => {
-        console.log('input view on layout')
-        if ('absolute' === this.state.position) {
-          this.state.position = 'relative'
-          this.setState({
-            position: 'relative'
-          })
-        }
-
-        if (this.inputViewHeight === undefined) {
-          this.inputViewHeight = height
-        }
-      }}
-    >
-      <View
-        style={[styles.inputView]}
-      >
-        {this.renderLeft()}
-        {this.renderTextInput()}
-        {this.renderRight()}
-      </View>
-      {this.renderBottom()}
-    </View>
-  }
-}
\ No newline at end of file
```

**File**: `ReactNative_JS/example/src/Message.js` (removed, +0/-185)
```diff
@@ -1,185 +0,0 @@
-import React, {Component} from "react";
-import PropTypes from 'prop-types';
-import { View, ViewPropTypes, StyleSheet, TouchableWithoutFeedback} from 'react-native';
-
-import Avatar from './Avatar';
-import MessageBubble from './MessageBubble';
-import MessageState from './MessageState';
-import UserName from './UserName';
-import MessageTime from './MessageTime';
-
-const styles = StyleSheet.create({
-  container: {
-    flex: 1,
-    marginVertical: 8.0
-  },
-  outGoing: {
-    flex: 1,
-    flexDirection: 'row',
-    
-  },
-  inComing: {
-    flex: 1,
-    flexDirection: 'row-reverse',
-  },
-  time: {
-    flex: 1,
-    alignContent: 'center',
-  },
-  reverse: {
-    flexDirection: 'row-reverse',
-  },
-  row: {
-    flexDirection: 'row',
-  },
-  defaultMessageBubbel: {
-    width: 200.0,
-    height: 200.0,
-    backgroundColor: 'white',
-  }
-})
-
-export default class Message extends Component {
-
-  constructor(props) {
-    super(props)
-
-    this._renderTime = this._renderTime.bind(this)
-    this._renderUserName = this._renderUserName.bind(this)
-    this._renderAvatar = this._renderAvatar.bind(this)
-    this._renderStateView = this._renderStateView.bind(this)
-    this._renderMessageContent = this._renderMessageContent.bind(this)
-    this._onMsgClick = this._onMsgClick.bind(this)
-  }
-
-  shouldComponentUpdate() {
-    return true
-  }
-  
-  _renderTime() {
-    if (!this.props.timeString) {
-      return null
-    }
-
-    if (this.props.renderTime && 
-        this.props.renderTime.constructor === Function) {
-      return this.props.renderTime({...this.props})
-    } else {
-      return <MessageTime {...this.props}/>
-    }
-  }
-
-  _renderUserName() {
-    if (!this.props.fromUser ||
-        !this.props.fromUser.displayName) {
-      return null
-    }
-
-    if (this.props.renderUserName &&
-        this.props.renderUserName.constructor === Function) {
-      return this.props.renderUserName({...this.props.fromUser})
-    } else {
-      return <UserName {...this.props.fromUser}/>
-    }
-  }
-
-  _renderAvatar() {
-    if (this.props.renderAvatar &&
-        this.props.renderAvatar.constructor === Function) {
-      return this.props.renderAvatar({...this.props.fromUser})
-    } else {
-      return <Avatar 
-        {...this.props}
-        {...this.props.fromUser}
-      />
-    }
-  }
-
-  _renderStateView() {
-    if (this.props.renderStateView &&
-        this.props.renderStateView.constructor === Function) {
-      return this.props.renderStateView({...this.props})
-    } else {
-      return <MessageState {...this.props}/>
-    }
-  }
-
-  _renderMessageContent() {
-    if (this.props.messageContent &&
-        this.props.messageContent.constructor === Function) {
-      return (
-        this.props.messageContent(this.props)
-      );
-    }
-    return <View style={styles.defaultMessageBubbel}></View>
-  }
-
-  _onMsgClick() {
-    this.props.onMsgClick &&
-      this.props.onMsgClick.constructor === Function &&
-      this.props.onMsgClick({...this.props})
-  }
-
-  render() {
-    return <View 
-      style={styles.container}
-    >
-      <TouchableWithoutFeedback
-        onPress={this._onMsgClick}
-        onLongPress={this._onMsgClick}
-      >
-        <View style={{}}>
-          {this._renderTime()}
-          <View
-            style={!this.props.isOutgoing ? styles.outGoing : styles.inComing}
-          >
-            {this._renderAvatar()}
-            <View>
-              <View  style={!this.props.isOutgoing ? styles.row : styles.reverse}>
-                {this._renderUserName()}
-              </View>
-              <View style={!this.props.isOutgoing ? styles.outGoing : styles.inComing}>
-                <MessageBubble {...this.props}>
-                  {this._renderMessageContent()}
-                </MessageBubble>
-                {this._renderStateView()}
-              </View>
-            </View>
-          </View>
-        </View>
-      </TouchableWithoutFeedback>
-    </View>
-  }
-}
-
-
-Message.propTypes = {
-  msgId: PropTypes.string.isRequired,
-  status: PropTypes.string,
-  fromUser: PropTypes.object,
-  isOutGoing: PropTypes.bool,
-
-  renderTime: PropTypes.func,
-  renderUserName: PropTypes.func,
-  renderAvatar: PropTypes.func,
-  avatarContent: PropTypes.func,
-  renderStateView: PropTypes.func,
-  messageContent: PropTypes.func,
-
-  onAvatarClick: PropTypes.func,
-  onMsgClick: PropTypes.func,
-  onStatusViewClick: PropTypes.func,
-
-  stateContainerStyles: PropTypes.object,
-  
-};
-
-Message.defaultProps = {
-  status: 'send_succeed',
-  fromUser: {},
-  isOutGoing: true,
-
-  onAvatarClick: () => {},
-  onMsgClick: () => {},
-  onStatusViewClick: () => {},
-};
\ No newline at end of file
```

**File**: `ReactNative_JS/example/src/MessageBubble.js` (removed, +0/-45)
```diff
@@ -1,45 +0,0 @@
-import React, {Component} from "react";
-import PropTypes from 'prop-types';
-import { View, ViewPropTypes, StyleSheet, TouchableWithoutFeedback } from 'react-native';
-
-const styles = StyleSheet.create({
-  bubble: {
-    borderRadius: 8,
-    overflow: "hidden",
-    backgroundColor: "white",
-  }
-})
-
-export default class MessageBubble extends Component {
-  constructor(props) {
-    super(props)
-    this._onMsgContentClick = this._onMsgContentClick.bind(this)
-    this._onMsgContentLongClick = this._onMsgContentLongClick.bind(this)
-  }
-
-  _onMsgContentClick() {
-     
-    this.props.onMsgContentClick && 
-      this.props.onMsgContentClick.constructor === Function &&
-      this.props.onMsgContentClick({...this.props, children: undefined})
-  }
-  
-  _onMsgContentLongClick() {
-    this.props.onMsgContentLongClick && 
-      this.props.onMsgContentLongClick.constructor === Function &&
-      this.props.onMsgContentLongClick({...this.props, children: undefined})
-  }
-
-  render() {
-    return <TouchableWithoutFeedback
-      onPress={this._onMsgContentClick}
-      onLongPress={this._onMsgContentLongClick}
-    >
-      <View style={styles.bubble}>
-        {this.props.children}
-      </View>
-    </TouchableWithoutFeedback>
-    
-
-  }
-}
\ No newline at end of file
```

**File**: `ReactNative_JS/example/src/MessageList.js` (removed, +0/-131)
```diff
@@ -1,131 +0,0 @@
-import React, {Component} from "react";
-import { View, Dimensions, RefreshControl } from 'react-native';
-import {RecyclerListView, LayoutProvider, DataProvider, BaseItemAnimator} from "recyclerlistview";
-import Message from "./Message";
-import Event from "./Event";
-import MessageTextContent from "./MessageTextContent";
-
-let {width} = Dimensions.get('window');
-
-export default class MessageList extends Component {
-  constructor(props) {
-    super(props);
-    this.state = {
-        dataProvider: new DataProvider((r1, r2) => {
-          return r1 !== r2
-        }, (index) => {
-          return this.props.messageList[index].values.msgId
-        }).cloneWithRows(props.messageList),
-        refreshing: false
-    };
-    
-    this._layoutProvider = new LayoutProvider((i) => {
-        return this.state.dataProvider.getDataForIndex(i).type;
-    }, (type, dim, index) => {
-        dim.height = 300;
-        dim.width = width;
-    });
-    
-    this._renderRow = this._renderRow.bind(this);
-    this.scrollToIndex = this.scrollToIndex.bind(this);
-  }
-
-  scrollToIndex(index, animate = false) {
-    if (this.messageListRef) {
-      this.messageListRef.scrollToIndex(index, animate)
-    }
-  }
-
-  scrollToEnd(animate = false) {
-    if (this.messageListRef) {
-      this.messageListRef.scrollToEnd(animate)
-    }
-  }
-
-  scrollToTop(animate = false) {
-    if (this.messageListRef) {
-      this.messageListRef.scrollToTop(animate)
-    }
-  }
-
-  scrollToOffset(offset, animate) {
-    if (this.messageListRef) {
-      this.messageListRef.scrollToOffset(offset, animate)
-    }
-  }
-
-  scrollToItem(item, animate) {
-    if (this.messageListRef) {
-      this.messageListRef.scrollToItem(item)
-    }
-  }
-
-  _renderRow(type, data) {
-    const message = {...data.values}
-    if (this.props.renderRow &&
-        this.props.renderRow.constructor === Function) {
-      const customRow = this.props.renderRow(message)
-      if (customRow) {
-        return customRow
-      }
-    }
-
-    switch (type) {
-        case "event":
-          return <Event {...data.values}/>
-        case "text":
-          return <Message {...{...message, messageContent: (message) => {return <MessageTextContent {...message}/>}}}
-              onMsgClick={this.props.onMsgClick}
-              onAvatarClick={this.props.onAvatarClick}
-              onStatusViewClick={this.props.onStatusViewClick}
-              onMsgContentClick={this.props.onMsgContentClick}
-              onMsgContentLongClick={this.props.onMsgContentLongClick}
-              avatarContent={this.props.avatarContent}
-              stateContainerStyles={this.props.stateContainerStyles}
-              avatarContainerStyles={this.props.avatarContainerStyles}
-          />
-        default:
-          return null;
-    }
-  }
-
-  static getDerivedStateFromProps(props, state) {
-    return {
-      dataProvider: state.dataProvider.cloneWithRows(props.messageList)
-    }
-  }
-
-  render() {
-    return (<View style={{flex: 1}}
-      {...this.props}
-    >
-      <RecyclerListView
-        contentContainerStyle={[this.props.messageListStyle ? this.props.messageListStyle : {}]}
-        renderAheadOffset={1000000}
-        ref={(messageListRef) => {this.messageListRef = messageListRef}}
-        rowRenderer={this._renderRow} 
-        dataProvider={this.state.dataProvider}
-        extendedState={this.props.extendedState}
-        layoutProvider={this._layoutProvider}
-        forceNonDeterministicRendering={true}
-        itemAnimator={BaseItemAnimator()}
-        optimizeForInsertDeleteAnimations={true}
-        scrollViewProps={{
-          refreshControl:  
-              <RefreshControl
-                refreshing={this.state.refreshing} 
-                onRefresh={ async () => {
-                    this.setState({
-                      refreshing: true
-                    })
-                    await this.props.onPullToRefresh()
-                    this.setState({
-                      refreshing: false
-                    })
-                }}
-              />
-      }}
-    />
-    </View>)
-  }
-}
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #709** (closed): Bump moment from 2.22.2 to 2.29.2 in /ReactNative_JS/example (@dependabot[bot])
- **PR #686** (closed): Bump handlebars from 4.0.12 to 4.7.6 in /ReactNative_JS/example (@dependabot[bot])
- **PR #684** (closed): Bump lodash from 4.17.11 to 4.17.19 in /ReactNative_JS/example (@dependabot[bot])
- **PR #672** (closed): Bump handlebars from 4.0.12 to 4.5.3 in /ReactNative_JS/example (@dependabot[bot])
- **PR #632** (2019-07-18): Dev (@JoshLipan)
- **PR #624** (2019-06-17): fix inputview crash bug (@raoxudong)
- **PR #576** (2019-03-01): update fix do not have camera flash take picture crash bug (@huangminlinux)
- **PR #563** (2019-02-12): Dev (@JoshLipan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
