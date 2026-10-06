# Forensic Learning Record (Deep Inspection): vanniktech/Emoji

> **Canonical Artifact**: `07_PROJECT_LEARNING/vanniktech-emoji-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vanniktech/Emoji](https://github.com/vanniktech/Emoji))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:34:15.997Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vanniktech/Emoji`
- **Description**: A library to add Emoji support to your Android / iOS / JVM Application
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1641 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `emoji/src/androidMain/kotlin/com/vanniktech/emoji/internal/ParcelableUtils.kt`
```
package com.vanniktech.emoji.internal

import android.os.Bundle
import android.os.Parcelable

inline fun <reified T : Parcelable> Bundle.parcelable(key: String): T? = when {
  // Does not work yet, https://issuetracker.google.com/issues/240585930
  // SDK_INT >= 33 -> getParcelable(key, T::class.java)
  else -> @Suppress("DEPRECATION") getParcelable(key) as? T
}

```

### Core Architecture Module: `emoji/src/androidMain/kotlin/com/vanniktech/emoji/internal/Utils.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.internal

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.res.Configuration
import android.graphics.Point
import android.graphics.Rect
import android.util.TypedValue
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.PopupWindow
import androidx.annotation.AttrRes
import androidx.annotation.ColorInt
import androidx.annotation.ColorRes
import androidx.core.content.ContextCompat
import com.vanniktech.emoji.EmojiAndroidProvider
import com.vanniktech.emoji.EmojiManager
import kotlin.math.roundToInt

private const val DONT_UPDATE_FLAG = -1

internal object Utils {
  internal fun dpToPx(context: Context, dp: Float): Int = (
    TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      dp,
      context.resources.displayMetrics,
    ) + 0.5f
    ).roundToInt()

  private fun getOrientation(context: Context): Int = context.resources.configuration.orientation

  internal fun getProperWidth(activity: Activity): Int {
    val rect = windowVisibleDisplayFrame(activity)
    return if (getOrientation(activity) == Configuration.ORIENTATION_PORTRAIT) rect.right else getScreenWidth(activity)
  }

  internal fun shouldOverrideRegularCondition(context: Context, editText: EditText): Boolean = if (editText.imeOptions and EditorInfo.IME_FLAG_NO_EXTRACT_UI == 0) {
    getOrientation(context) == Configuration.ORIENTATION_LANDSCAPE
  } else {
    false
  }

  internal fun getProperHeight(activity: Activity): Int = windowVisibleDisplayFrame(activity).bottom

  private fun getScreenWidth(context: Activity): Int = dpToPx(context, context.resources.configuration.screenWidthDp.toFloat())

  internal fun locationOnScreen(view: View): Point {
    val location = IntArray(2)
    view.getLocationOnScreen(location)
    return Point(location[0], location[1])
  }

  private fun windowVisibleDisplayFrame(context: Activity): Rect {
    val result = Rect()
    context.window.decorView.getWindowVisibleDisplayFrame(result)
    return result
  }

  internal fun asActivity(context: Context): Activity {
    var result: Context? = context
    while (result is ContextWrapper) {
      if (result is Activity) {
        return result
      }
      result = result.baseContext
    }
    error("The passed Context is not an Activity.")
  }

  internal fun fixPopupLocation(popupWindow: PopupWindow, desiredLocation: Point) {
    popupWindow.contentView.post {
      val actualLocation = locationOnScreen(popupWindow.contentView)
      if (!(actualLocation.x == desiredLocation.x && actualLocation.y == desiredLocation.y)) {
        val differenceX = actualLocation.x - desiredLocation.x
        val differenceY = actualLocation.y - desiredLocation.y
        val fixedOffsetX = if (actualLocation.x > desiredLocation.x) {
          desiredLocation.x - differenceX
        } else {
          desiredLocation.x + differenceX
        }
        val fixedOffsetY = if (actualLocation.y > desiredLocation.y) {
          desiredLocation.y - differenceY
        } else {
          desiredLocation.y + differenceY
        }
        popupWindow.update(fixedOffsetX, fixedOffsetY, DONT_UPDATE_FLAG, DONT_UPDATE_FLAG)
      }
    }
  }

  @ColorInt
  internal fun resolveColor(context: Context, @AttrRes resource: Int, @ColorRes fallback: Int): Int {
    val value = TypedValue()
    context.theme.resolveAttribute(resource, value, true)
    val resolvedColor = if (value.resourceId != 0) {
      ContextCompat.getColor(context, value.resourceId)
    } else {
      value.data
    }
    return if (resolvedColor != 0) {
      resolvedColor
    } else {
      ContextCompat.getColor(context, fallback)
    }
  }
}

internal inline val Context.inputMethodManager get() = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
internal fun EditText.showKeyboardAndFocus() {
  post {
    requestFocus()
    context.inputMethodManager.showSoftInput(this, 0)
  }
}

internal fun EditText.hideKeyboardAndFocus() {
  post {
    clearFocus()
    context.inputMethodManager.hideSoftInputFromWindow(windowToken, 0)
  }
}

internal fun EmojiManager.emojiDrawableProvider(): EmojiAndroidProvider {
  val emojiProvider = emojiProvider()
  require(emojiProvider is EmojiAndroidProvider) { "Your provider needs to implement EmojiDrawableProvider" }
  return emojiProvider
}

```

### Core Architecture Module: `app/src/main/kotlin/com/vanniktech/emoji/sample/ChatAdapter.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.sample

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.vanniktech.emoji.EmojiTextView
import com.vanniktech.emoji.emojiInformation
import com.vanniktech.emoji.sample.ChatAdapter.ChatViewHolder

internal class ChatAdapter : RecyclerView.Adapter<ChatViewHolder>() {
  private val texts = mutableListOf<String>()

  override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatViewHolder {
    val layoutInflater = LayoutInflater.from(parent.context)
    return ChatViewHolder(layoutInflater.inflate(R.layout.item_adapter_chat, parent, false))
  }

  override fun onBindViewHolder(chatViewHolder: ChatViewHolder, position: Int) {
    val text = texts[position]
    val emojiInformation = text.emojiInformation()
    val res: Int = when {
      emojiInformation.isOnlyEmojis && emojiInformation.emojiCount == 1 -> R.dimen.emoji_size_single_emoji
      emojiInformation.isOnlyEmojis && emojiInformation.emojiCount > 1 -> R.dimen.emoji_size_only_emojis
      else -> R.dimen.emoji_size_default
    }
    chatViewHolder.textView.setEmojiSizeRes(res, false)
    chatViewHolder.textView.text = text
  }

  override fun getItemCount() = texts.size

  fun add(text: String) {
    texts.add(text)
    notifyItemInserted(texts.size - 1)
  }

  internal class ChatViewHolder(view: View) : RecyclerView.ViewHolder(view) {
    val textView: EmojiTextView = view.findViewById(R.id.itemAdapterChatTextView)
  }
}

```

### Core Architecture Module: `app/src/main/kotlin/com/vanniktech/emoji/sample/CustomViewActivity.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.sample

import android.content.Context
import android.os.Bundle
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.MenuItem
import android.widget.LinearLayout
import androidx.appcompat.app.AppCompatActivity
import com.vanniktech.emoji.EmojiPopup
import com.vanniktech.emoji.installDisableKeyboardInput
import com.vanniktech.emoji.installForceSingleEmoji
import com.vanniktech.emoji.sample.databinding.ViewCustomBinding
import com.vanniktech.emoji.traits.EmojiTrait
import com.vanniktech.emoji.R as EmojiR

class CustomViewActivity : AppCompatActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val customView = CustomView(this, null)
    setContentView(customView)
    setSupportActionBar(customView.binding.toolbar)

    supportActionBar?.setDisplayHomeAsUpEnabled(true)
    supportActionBar?.setHomeAsUpIndicator(R.drawable.ic_close)

    customView.setUpEmojiPopup()
  }

  override fun onOptionsItemSelected(item: MenuItem) = when (item.itemId) {
    android.R.id.home -> {
      finish()
      true
    }
    else -> super.onOptionsItemSelected(item)
  }

  internal class CustomView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
  ) : LinearLayout(context, attrs) {
    internal val binding = ViewCustomBinding.inflate(LayoutInflater.from(context), this)

    private var forceSingleEmoji: EmojiTrait? = null

    init {
      orientation = VERTICAL
    }

    fun setUpEmojiPopup() {
      binding.forceSingleEmoji.setOnCheckedChangeListener { _, isChecked: Boolean ->
        if (isChecked) {
          forceSingleEmoji = binding.editText.installForceSingleEmoji()
        } else {
          forceSingleEmoji?.uninstall()
        }
      }

      val emojiPopup = EmojiPopup(
        rootView = this,
        keyboardAnimationStyle = EmojiR.style.emoji_fade_animation_style,
        editText = binding.editText,
      )
      binding.editText.installDisableKeyboardInput(emojiPopup)
      binding.button.setOnClickListener { binding.editText.requestFocus() }
    }
  }
}

```

### Core Architecture Module: `app/src/main/kotlin/com/vanniktech/emoji/sample/EmojiApplication.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.sample

import android.app.Application
import android.os.StrictMode
import android.os.StrictMode.ThreadPolicy
import android.os.StrictMode.VmPolicy
import androidx.appcompat.app.AppCompatDelegate
import com.vanniktech.emoji.EmojiManager
import com.vanniktech.emoji.ios.IosEmojiProvider
import timber.log.Timber

class EmojiApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
    EmojiManager.install(IosEmojiProvider())
    StrictMode.setThreadPolicy(ThreadPolicy.Builder().detectAll().build())
    StrictMode.setVmPolicy(VmPolicy.Builder().detectAll().build())

    Timber.plant(Timber.DebugTree())
  }
}

```

### Core Architecture Module: `app/src/main/kotlin/com/vanniktech/emoji/sample/EmojisActivity.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.sample

import android.os.Bundle
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import com.vanniktech.emoji.Emoji
import com.vanniktech.emoji.listeners.OnEmojiBackspaceClickListener
import com.vanniktech.emoji.listeners.OnEmojiClickListener
import com.vanniktech.emoji.sample.databinding.ActivityEmojisBinding

class EmojisActivity :
  AppCompatActivity(),
  OnEmojiClickListener,
  OnEmojiBackspaceClickListener {
  private lateinit var binding: ActivityEmojisBinding

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    binding = ActivityEmojisBinding.inflate(layoutInflater)
    setContentView(binding.root)
    setSupportActionBar(binding.toolbar)

    supportActionBar?.setDisplayHomeAsUpEnabled(true)
    supportActionBar?.setHomeAsUpIndicator(R.drawable.ic_close)

    binding.emojiView.setUp(
      rootView = binding.root,
      onEmojiClickListener = this,
      onEmojiBackspaceClickListener = this,
      editText = null,
    )
  }

  override fun onOptionsItemSelected(item: MenuItem) = when (item.itemId) {
    android.R.id.home -> {
      finish()
      true
    }
    else -> super.onOptionsItemSelected(item)
  }

  override fun onDestroy() {
    super.onDestroy()
    binding.emojiView.tearDown()
  }

  override fun onEmojiBackspaceClick() {
    binding.selectedEmoji.text = null
  }

  override fun onEmojiClick(emoji: Emoji) {
    binding.selectedEmoji.text = emoji.unicode
  }
}

```

### Core Architecture Module: `app/src/main/kotlin/com/vanniktech/emoji/sample/MainActivity.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.sample

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.PorterDuff
import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater.Factory2
import android.view.MenuItem
import android.view.View
import android.widget.PopupMenu
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.provider.FontRequest
import androidx.emoji.text.FontRequestEmojiCompatConfig
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.vanniktech.emoji.EmojiManager
import com.vanniktech.emoji.EmojiPopup
import com.vanniktech.emoji.androidxemoji2.AndroidxEmoji2Provider
import com.vanniktech.emoji.facebook.FacebookEmojiProvider
import com.vanniktech.emoji.google.GoogleEmojiProvider
import com.vanniktech.emoji.googlecompat.GoogleCompatEmojiProvider
import com.vanniktech.emoji.installDisableKeyboardInput
import com.vanniktech.emoji.installForceSingleEmoji
import com.vanniktech.emoji.installSearchInPlace
import com.vanniktech.emoji.ios.IosEmojiProvider
import com.vanniktech.emoji.material.MaterialEmojiLayoutFactory
import com.vanniktech.emoji.sample.databinding.ActivityMainBinding
import com.vanniktech.emoji.traits.EmojiTrait
import com.vanniktech.emoji.twitter.TwitterEmojiProvider
import timber.log.Timber
import androidx.emoji.text.EmojiCompat as EmojiCompat1
import androidx.emoji2.text.EmojiCompat as EmojiCompat2
import com.vanniktech.emoji.R as EmojiR

// We don't care about duplicated code in the sample.
class MainActivity : AppCompatActivity() {
  private lateinit var binding: ActivityMainBinding
  private lateinit var chatAdapter: ChatAdapter
  private lateinit var emojiPopup: EmojiPopup
  private var emojiCompat1: EmojiCompat1? = null
  private var emojiCompat2: EmojiCompat2? = null
  private var searchInPlaceEmojiTrait: EmojiTrait? = null
  private var disableKeyboardInputEmojiTrait: EmojiTrait? = null
  private var forceSingleEmojiTrait: EmojiTrait? = null

  @SuppressLint("SetTextI18n")
  override fun onCreate(savedInstanceState: Bundle?) {
    layoutInflater.factory2 = MaterialEmojiLayoutFactory(delegate as Factory2)
    super.onCreate(savedInstanceState)

    binding = ActivityMainBinding.inflate(layoutInflater)
    setContentView(binding.root)
    setSupportActionBar(binding.toolbar)

    chatAdapter = ChatAdapter()
    setUpShowcaseButtons()

    emojiPopup = EmojiPopup(
      rootView = binding.rootView,
      editText = binding.chatEditText,
      onEmojiBackspaceClickListener = { Timber.d(TAG, "Clicked on Backspace") },
      onEmojiClickListener = { emoji -> Timber.d(TAG, "Clicked on Emoji " + emoji.unicode) },
      onEmojiPopupShownListener = { binding.chatEmoji.setImageResource(R.drawable.ic_keyboard) },
      onSoftKeyboardOpenListener = { px -> Timber.d(TAG, "Opened soft keyboard with height $px") },
      onEmojiPopupDismissListener = { binding.chatEmoji.setImageResource(R.drawable.ic_emojis) },
      onSoftKeyboardCloseListener = { Timber.d(TAG, "Closed soft keyboard") },
      keyboardAnimationStyle = EmojiR.style.emoji_fade_animation_style,
//      theming = com.vanniktech.emoji.EmojiTheming( // Uncomment this to use runtime theming.
//        backgroundColor = android.graphics.Color.BLACK,
//        primaryColor = android.graphics.Color.BLUE,
//        secondaryColor = android.graphics.Color.YELLOW,
//        dividerColor = android.graphics.Color.GRAY,
//        textColor = android.graphics.Color.WHITE,
//        textSecondaryColor = android.graphics.Color.GRAY,
//      ),
      pageTransformer = PageTransformer(),
//      variantEmoji = NoVariantEmoji, // Uncomment this to hide variant emojis.
//      searchEmoji = NoSearchEmoji, // Uncomment this to hide search emojis.
//      recentEmoji = NoRecentEmoji, // Uncomment this to hide recent emojis.
    )

    binding.chatSend.setColorFilter(ContextCompat.getColor(this, R.color.colorPrimary), PorterDuff.Mode.SRC_IN)
    binding.chatEmoji.setColorFilter(ContextCompat.getColor(this, R.color.colorPrimary), PorterDuff.Mode.SRC_IN)
    binding.disableKeyboardInput.setOnCheckedChangeListener { _, isChecked: Boolean ->
      if (isChecked) {
        binding.searchInPlace.isChecked = false

        binding.chatEmoji.visibility = View.GONE
        disableKeyboardInputEmojiTrait = binding.chatEditText.installDisableKeyboardInput(emojiPopup)
      } else {
        binding.chatEmoji.visibility = View.VISIBLE
        disableKeyboardInputEmojiTrait?.uninstall()
      }
    }
    binding.forceSingleEmoji.setOnCheckedChangeListener { _, isChecked: Boolean ->
      if (isChecked) {
        binding.searchInPlace.isChecked = false

        if (!binding.disableKeyboardInput.isChecked) {
          binding.disableKeyboardInput.isChecked = true
        }

        forceSingleEmojiTrait = binding.chatEditText.installForceSingleEmoji()
      } else {
        forceSingleEmojiTrait?.uninstall()
      }
    }
    binding.searchInPlace.setOnCheckedChangeListener { _, isChecked: Boolean ->
      if (isChecked) {
        binding.disableKeyboardInput.isChecked = false
        binding.forceSingleEmoji.isChecked = false

        searchInPlaceEmojiTrait = binding.chatEditText.installSearchInPlace(emojiPopup)
      } else {
        searchInPlaceEmojiTrait?.uninstall()
      }
    }

    binding.chatEmoji.setOnClickListener { emojiPopup.toggle() }
    binding.chatSend.setOnClickListener {
      val text = binding.chatEditText.text.toString().trim { it <= ' ' }
      if (text.isNotEmpty()) {
        chatAdapter.add(text)
        binding.chatEditText.setText("")
      }
    }
    binding.recyclerView.adapter = chatAdapter
    binding.recyclerView.layoutManager = LinearLayoutManager(this, RecyclerView.VERTICAL, false)
  }

  @SuppressLint("SetTextI18n")
  private fun setUpShowcaseButtons() {
    binding.emojis.setOnClickListener {
      emojiPopup.dismiss()
      startActivity(Intent(this, EmojisActivity::class.java))
    }
    binding.customView.setOnClickListener {
      emojiPopup.dismiss()
      startActivity(Intent(this, CustomViewActivity::class.java))
    }
    binding.dialogButton.setOnClickListener {
      emojiPopup.dismiss()
      MainDialog.show(this)
    }
    binding.button.text = "Switch between Emoji Provider \uD83D\uDE18\uD83D\uDE02\uD83E\uDD8C"
    binding.button.setOnClickListener {
      val menu = PopupMenu(this, binding.button, Gravity.BOTTOM)
      menu.inflate(R.menu.menu_emoji_provider)
      menu.setOnMenuItemClickListener { menuItem: MenuItem ->
        when (menuItem.itemId) {
          R.id.menuEmojiProviderIos -> {
            EmojiManager.destroy()
            EmojiManager.install(IosEmojiProvider())
            recreate()
            return@setOnMenuItemClickListener true
          }
          R.id.menuEmojiProviderGoogle -> {
            EmojiManager.destroy()
            EmojiManager.install(GoogleEmojiProvider())
            recreate()
            return@setOnMenuItemClickListener true
          }
          R.id.menuEmojiProviderTwitter -> {
            EmojiManager.destroy()
            EmojiManager.install(TwitterEmojiProvider())
            recreate()
            return@setOnMenuItemClickListener true
          }
          R.id.menuEmojiProviderFacebook -> {
            EmojiManager.destroy()
            EmojiManager.install(FacebookEmojiProvider())
            recreate()
            return@setOnMenuItemClickListener true
          }
          R.id.menuEmojiProviderGoogleCompat -> {
            if (emojiCompat1 == null) {
              emojiCompat1 = EmojiCompat1.init(
                FontRequestEmojiCompatConfig(
                  this,
                  FontRequest(
                    "com.google.android.gms.fonts",
                    "com.google.android.gms",
                    "Noto Color Emoji Compat",
                    R.array.com_google_android_gms_fonts_certs,
                  ),
                ).setReplaceAll(true),
              )
            }

            emojiCompat2 = null

            EmojiManager.destroy()
            EmojiManager.install(GoogleCompatEmojiProvider(emojiCompat1!!))
            recreate()
            return@setOnMenuItemClickListener true
          }
          R.id.menuEmojiProviderAndroidxEmoji2 -> {
            if (emojiCompat2 == null) {
              emojiCompat2 = EmojiCompat2.init(this)
            }

            emojiCompat1 = null

            EmojiManager.destroy()
            EmojiManager.install(AndroidxEmoji2Provider(emojiCompat2!!))
            recreate()
            return@setOnMenuItemClickListener true
          }
          else -> {
            return@setOnMenuItemClickListener false
          }
        }
      }
      menu.show()
    }
  }

  companion object {
    const val TAG = "MainActivity"
  }
}

```

### Core Architecture Module: `app/src/main/kotlin/com/vanniktech/emoji/sample/MainDialog.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.sample

import android.app.Dialog
import android.graphics.PorterDuff
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.fragment.app.DialogFragment
import androidx.recyclerview.widget.RecyclerView
import com.vanniktech.emoji.Emoji
import com.vanniktech.emoji.EmojiPopup
import com.vanniktech.emoji.material.MaterialEmojiLayoutFactory
import timber.log.Timber
import com.vanniktech.emoji.R as EmojiR

// We don't care about duplicated code in the sample.
class MainDialog : DialogFragment() {
  override fun onCreate(savedInstanceState: Bundle?) {
    layoutInflater.factory2 = MaterialEmojiLayoutFactory(null)
    super.onCreate(savedInstanceState)
  }

  override fun onCreateDialog(savedInstanceState: Bundle?): Dialog = AlertDialog.Builder(requireContext())
    .setView(buildView())
    .create()

  private fun buildView(): View? {
    val context = requireContext()
    val result = View.inflate(context, R.layout.dialog_main, null)
    val editText = result.findViewById<EditText>(R.id.main_dialog_chat_bottom_message_edittext)
    val rootView = result.findViewById<View>(R.id.main_dialog_root_view)
    val emojiButton = result.findViewById<ImageButton>(R.id.main_dialog_emoji)
    val sendButton = result.findViewById<ImageView>(R.id.main_dialog_send)

    val emojiPopup = EmojiPopup(
      rootView = rootView,
      editText = editText,
      onEmojiBackspaceClickListener = { Timber.d(TAG, "Clicked on Backspace") },
      onEmojiClickListener = { emoji: Emoji -> Timber.d(TAG, "Clicked on Emoji " + emoji.unicode) },
      onEmojiPopupShownListener = { emojiButton.setImageResource(R.drawable.ic_keyboard) },
      onSoftKeyboardOpenListener = { px -> Timber.d(TAG, "Opened soft keyboard with height $px") },
      onEmojiPopupDismissListener = { emojiButton.setImageResource(R.drawable.ic_emojis) },
      onSoftKeyboardCloseListener = { Timber.d(TAG, "Closed soft keyboard") },
      keyboardAnimationStyle = EmojiR.style.emoji_fade_animation_style,
    )

    emojiButton.setColorFilter(ContextCompat.getColor(context, R.color.colorPrimary), PorterDuff.Mode.SRC_IN)
    sendButton.setColorFilter(ContextCompat.getColor(context, R.color.colorPrimary), PorterDuff.Mode.SRC_IN)
    val chatAdapter = ChatAdapter()
    emojiButton.setOnClickListener { emojiPopup.toggle() }
    sendButton.setOnClickListener {
      val text = editText.text.toString().trim { it <= ' ' }
      if (text.isNotEmpty()) {
        chatAdapter.add(text)
        editText.setText(null)
      }
    }
    val recyclerView: RecyclerView = result.findViewById(R.id.main_dialog_recycler_view)
    recyclerView.adapter = chatAdapter
    return rootView
  }

  internal companion object {
    const val TAG = "MainDialog"

    fun show(activity: AppCompatActivity) {
      MainDialog().show(activity.supportFragmentManager, TAG)
    }
  }
}

```

### Core Architecture Module: `app/src/main/kotlin/com/vanniktech/emoji/sample/PageTransformer.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.sample

import android.view.View
import androidx.viewpager.widget.ViewPager
import kotlin.math.abs
import kotlin.math.max

class PageTransformer : ViewPager.PageTransformer {
  override fun transformPage(page: View, position: Float) {
    when {
      position < -1 -> {
        // [-Infinity,-1)
        // This page is way off-screen to the left.
        page.alpha = 0f
      }
      position <= 1 -> {
        // [-1,1]
        page.scaleX = max(MIN_SCALE, 1 - abs(position))
        page.scaleY = max(MIN_SCALE, 1 - abs(position))
        page.alpha = max(MIN_ALPHA, 1 - abs(position))
      }
      else -> {
        // (1,+Infinity]
        // This page is way off-screen to the right.
        page.alpha = 0f
      }
    }
  }

  companion object {
    private const val MIN_SCALE = 0.9f
    private const val MIN_ALPHA = 0.1f
  }
}

```

### Core Architecture Module: `emoji-androidx-emoji2/src/androidMain/kotlin/com/vanniktech/emoji/androidxemoji2/AndroidxEmoji2Drawable.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.androidxemoji2

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable
import android.text.Spanned
import android.text.TextPaint
import androidx.emoji2.text.EmojiCompat
import androidx.emoji2.text.EmojiSpan
import kotlin.math.roundToInt

/**
 * An emoji drawable backed by a span generated by the Google emoji support library.
 */
internal class AndroidxEmoji2Drawable(
  unicode: String,
) : Drawable() {
  private var emojiSpan: EmojiSpan? = null
  private var processed = false
  private var emojiCharSequence: CharSequence? = unicode
  private val textPaint = TextPaint().apply {
    style = Paint.Style.FILL
    color = -0x1
    isAntiAlias = true
  }

  private fun process() {
    val sequence = EmojiCompat.get().process(emojiCharSequence)
    emojiCharSequence = sequence

    if (sequence is Spanned) {
      val spans = sequence.getSpans(0, sequence.length, EmojiSpan::class.java)

      if (spans.isNotEmpty()) {
        emojiSpan = spans[0] as EmojiSpan
      }
    }
  }

  override fun draw(canvas: Canvas) {
    val bounds = bounds
    textPaint.textSize = bounds.height() * TEXT_SIZE_FACTOR
    val y = (bounds.bottom - bounds.height() * BASELINE_OFFSET_FACTOR).roundToInt()

    if (!processed && EmojiCompat.get().loadState != EmojiCompat.LOAD_STATE_LOADING) {
      processed = true
      if (EmojiCompat.get().loadState != EmojiCompat.LOAD_STATE_FAILED) {
        process()
      }
    }

    val sequence = emojiCharSequence

    if (sequence != null) {
      if (emojiSpan == null) {
        canvas.drawText(sequence, 0, sequence.length, bounds.left.toFloat(), y.toFloat(), textPaint)
      } else {
        emojiSpan!!.draw(canvas, sequence, 0, sequence.length, bounds.left.toFloat(), bounds.top, y, bounds.bottom, textPaint)
      }
    }
  }

  override fun setAlpha(alpha: Int) {
    textPaint.alpha = alpha
  }

  override fun setColorFilter(colorFilter: ColorFilter?) {
    textPaint.colorFilter = colorFilter
  }

  @Suppress("OVERRIDE_DEPRECATION")
  override fun getOpacity(): Int = PixelFormat.UNKNOWN

  internal companion object {
    private const val TEXT_SIZE_FACTOR = 0.8f
    private const val BASELINE_OFFSET_FACTOR = 0.225f
  }
}

```

### Core Architecture Module: `emoji-androidx-emoji2/src/androidMain/kotlin/com/vanniktech/emoji/androidxemoji2/AndroidxEmoji2Provider.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.androidxemoji2

import android.content.Context
import android.graphics.drawable.Drawable
import android.text.Spannable
import androidx.emoji2.text.EmojiCompat
import com.vanniktech.emoji.Emoji
import com.vanniktech.emoji.EmojiAndroidProvider
import com.vanniktech.emoji.EmojiCategory
import com.vanniktech.emoji.EmojiProvider
import com.vanniktech.emoji.EmojiReplacer
import com.vanniktech.emoji.androidxemoji2.category.ActivitiesCategory
import com.vanniktech.emoji.androidxemoji2.category.AnimalsAndNatureCategory
import com.vanniktech.emoji.androidxemoji2.category.FlagsCategory
import com.vanniktech.emoji.androidxemoji2.category.FoodAndDrinkCategory
import com.vanniktech.emoji.androidxemoji2.category.ObjectsCategory
import com.vanniktech.emoji.androidxemoji2.category.SmileysAndPeopleCategory
import com.vanniktech.emoji.androidxemoji2.category.SymbolsCategory
import com.vanniktech.emoji.androidxemoji2.category.TravelAndPlacesCategory

class AndroidxEmoji2Provider(
  @Suppress("unused") private val emojiCompat: EmojiCompat,
) : EmojiProvider,
  EmojiAndroidProvider,
  EmojiReplacer {
  override val categories: Array<EmojiCategory>
    get() = arrayOf(
      SmileysAndPeopleCategory(),
      AnimalsAndNatureCategory(),
      FoodAndDrinkCategory(),
      ActivitiesCategory(),
      TravelAndPlacesCategory(),
      ObjectsCategory(),
      SymbolsCategory(),
      FlagsCategory(),
    )

  override fun getIcon(emojiCategory: EmojiCategory): Int = when (emojiCategory) {
    is SmileysAndPeopleCategory -> R.drawable.emoji_androidxemoji2_category_smileysandpeople
    is AnimalsAndNatureCategory -> R.drawable.emoji_androidxemoji2_category_animalsandnature
    is FoodAndDrinkCategory -> R.drawable.emoji_androidxemoji2_category_foodanddrink
    is ActivitiesCategory -> R.drawable.emoji_androidxemoji2_category_activities
    is TravelAndPlacesCategory -> R.drawable.emoji_androidxemoji2_category_travelandplaces
    is ObjectsCategory -> R.drawable.emoji_androidxemoji2_category_objects
    is SymbolsCategory -> R.drawable.emoji_androidxemoji2_category_symbols
    is FlagsCategory -> R.drawable.emoji_androidxemoji2_category_flags
    else -> error("Unknown $emojiCategory")
  }

  override fun replaceWithImages(
    context: Context,
    text: Spannable,
    emojiSize: Float,
    fallback: EmojiReplacer?,
  ) {
    val emojiCompat = EmojiCompat.get()
    if (emojiCompat.loadState != EmojiCompat.LOAD_STATE_SUCCEEDED || emojiCompat.process(text, 0, text.length) !== text) {
      fallback?.replaceWithImages(context, text, emojiSize, null)
    }
  }

  override fun getDrawable(emoji: Emoji, context: Context): Drawable = AndroidxEmoji2Drawable(emoji.unicode)
  override fun release() = Unit
}

```

### Core Architecture Module: `emoji-androidx-emoji2/src/commonMain/kotlin/com/vanniktech/emoji/androidxemoji2/AndroidxEmoji2.kt`
```
/*
 * Copyright (C) 2016 - Niklas Baudy, Ruben Gees, Mario Đanić and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.vanniktech.emoji.androidxemoji2

import com.vanniktech.emoji.Emoji

internal class AndroidxEmoji2 internal constructor(
  override val unicode: String,
  override val shortcodes: List<String>,
  override val variants: List<AndroidxEmoji2> = emptyList(),
  private var parent: AndroidxEmoji2? = null,
) : Emoji {
  override val base by lazy(LazyThreadSafetyMode.NONE) {
    var result = this
    while (result.parent != null) {
      result = result.parent!!
    }
    result
  }

  init {
    for (variant in variants) {
      variant.parent = this
    }
  }

  override fun equals(other: Any?): Boolean {
    if (this === other) return true
    if (other == null || this::class != other::class) return false

    other as AndroidxEmoji2

    if (unicode != other.unicode) return false
    if (shortcodes != other.shortcodes) return false
    if (variants != other.variants) return false

    return true
  }

  override fun toString() = "AndroidxEmoji2(unicode='$unicode', shortcodes=$shortcodes, variants=$variants)"

  override fun hashCode(): Int {
    var result = unicode.hashCode()
    result = 31 * result + shortcodes.hashCode()
    result = 31 * result + variants.hashCode()
    return result
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #758** (2025-09-08): **When click on emoji button keyboard is open but edit text is not show emoji keyboard is overlap the edit text.**
  *Symptoms*: ![image](https://user-images.githubusercontent.com/79579633/166922144-c4621d87-25a1-42a1-b5c0-5385511874a1.png) 
  **Post-Mortem & Fix Analysis**:
  > Can you reproduce in the sample app?
  > > Can you reproduce in the sample app?  I was already try that. also this is happen in Samsung device A-52
  > ![image](https://user-images.githubusercontent.com/79579633/167066777-4a7683ad-2d1a-426e-b021-ed6091c72270.png)   @vanniktech If you have removed this bottom view resolved this issue.  

- **Issue #485** (2024-05-17): **EmojiUtils.isOnlyEmojis cannot detect 🗯 ,  🗨,  🕳, ❤, ❣ .... **
  *Symptoms*: Thank you for filing an issue. If this is a bug that you want to report, please take the time to provide some information:  - Version of the library:  0.7.0 - Affected devices: Any - Affected versions: Any  To replicate issue :  EmojiUtils.isOnlyEmojis("🗯")  // false EmojiUtils.isOnlyEmojis("🗨")  // false EmojiUtils.isOnlyEmojis("🕳")  // false EmojiUtils.isOnlyEmojis("❤")  // false EmojiUtils.isOnlyEmojis("❣")  // false  * this happens to all emojis with 2 codepoints like this: ` new GoogleEmoji(new int[] { 0x1F5E8, 0xFE0F }, new String[]{"left_speech_bubble"}, 30, 26, false), new GoogleEmoji(new int[] { 0x1F5EF, 0xFE0F }, new String[]{"right_anger_bubble"}, 30, 27, false), `   

- **Issue #369** (2019-07-14): **The memory of the device will grow up and finally crash.**
  *Symptoms*: Hello I use the last commit of master for my application. I build EmojiPopup from onCreate of my fragment. My fragment will be created and destroyed much time. Problem: The memory of the device will grow up and finally crash. The instance of EmojiPopup is not static and does not collect by GC. Why?
  **Post-Mortem & Fix Analysis**:
  > Problem Solved: steps: 1- adding below function to EmojiPopup.java   public void releaseMemory() {     if (Build.VERSION.SDK_INT < 16) {       rootView.getViewTreeObserver().removeGlobalOnLayoutListener(onGlobalLayoutListener);     } else {       rootView.getViewTreeObserver().removeOnGlobalLayoutListener(onGlobalLayoutListener);     }   } 2- calling this function from onDestroyView of fragment.  Please add this method to lib or handle it in some other way.
  > cc @rubengees what do you think?
  > This looks like a memory leak which is caused by our layout listener for the keyboard. @bagvant could you put together a minimal sample App for reproduction? 

- **Issue #275** (2018-09-11): **OOM with the new sheet approach**
  *Symptoms*: - Version of the library: Current `SNAPSHOT` - Affected devices: Low memory devices - Affected versions: Potentially all  I ran into an OOM with one of my old devices when opening an `Activity` with an `EmojiTextView`. This is due to the emoji `Bitmap` being really large when decoded. I can't really use it in production like that sadly.  I tried: - Only decoding the part of the sheet needed with [BitmapRegionDecoder](https://developer.android.com/reference/android/graphics/BitmapRegionDecoder.html): Way too slow. - Using a [different decoder](https://github.com/suckgamony/RapidDecoder) for the same purpose: Way too slow.  I can't come up with a solution at this point. Maybe someone else has an idea? Otherwise: Should we revert?
  **Post-Mortem & Fix Analysis**:
  > Before the png image is 72px, change it to 64px, also can reduce the library size.
  > There must be an option to work with Bitmaps. Everyone is doing that. Whatsapp, Slack etc. Maybe there's a magic flag somewhere?
  > Some of my users are having OOM too.  Signal for Android is using a few methods which might help:  * they used one sheet per category * they somewhat scaled the bitmap to save memory:  ``` Bitmap scaledBitmap = Bitmap.createScaledBitmap(originalBitmap, (int)(originalBitmap.getWidth() * decodeScale), (int)(originalBitmap.getHeight() * decodeScale), false); ```  Details here: https://github.com/signalapp/Signal-Android/blob/master/src/org/thoughtcrime/securesms/components/emoji/parsing/EmojiPageBitmap.java#L82  I'll do some tests and see if I can detect a memory saving using profiling tools in Android Studio, but I don't have a low-end device to try them.

- **Issue #263** (2018-09-25): **Problem in the languages ​​right to left**
  *Symptoms*: Problem in the languages ​​right to left. please help  Device language rtl ![screenshot_ - - - - -](https://user-images.githubusercontent.com/29945866/37075276-4e99696c-21e6-11e8-998a-50ccce693de5.png)   ---------------------------------------------------------------------- Device language ltr ![screenshot_2018-03-07-08-46-41](https://user-images.githubusercontent.com/29945866/37075337-a3410f2e-21e6-11e8-8797-7cfd74ad40fd.png)    Please help me thanks. 
  **Post-Mortem & Fix Analysis**:
  > Oh that can definitely be fixed. Wanna take a stab at it?
  > Working for me in the sample app.  ![1537896977](https://user-images.githubusercontent.com/5759366/46031830-4b26ef80-c0fa-11e8-9a61-eb11f0507eeb.png) 

- **Issue #251** (2018-02-23): **EmojiPopup not showing up on Galaxy S8**
  *Symptoms*: It's working fine on the emulator but when I deploy my app to my Samsung Galaxy S8 with Android 7.0, the EmojiPopup doesn't show up. Only the normal keyboard pops up. I get no errors in Logcat and when I call isShowing() it returns true. I'm using version 0.6.0-SNAPSHOT.
  **Post-Mortem & Fix Analysis**:
  > We had this already a couple of times and I'm surprised 0.6.0 does not fix that. Could you debug this and see whether this might be something that can be fixed?
  > I'm closing this issue due to inactivity. If you have any further input on the issue, don't hesitate to reopen this issue or post a new one.

- **Issue #191** (2019-01-23): **Galaxy E7 Duos 3G SM-E700H : On this device the soft keyboard and emoji pop are inflated together.**
  *Symptoms*: I have a Samsung galaxy E7 duos, while testing this library i found that the soft keyboard and emoji pop up are visible together. Is there a way or any workaround to handle this? Coz its working on all the devices except this one. I am attaching a screen shot to explain a bit more.     ![samsung e7](https://user-images.githubusercontent.com/22674371/29397027-3adbc470-8339-11e7-8ea5-c7f208841cd3.png)  ----------------------------------------------------------------------
  **Post-Mortem & Fix Analysis**:
  > Hmm do other applications that do this kind of thing work? E.g. WhatsApp or telegram?
  > Nopes!! Its working fine in WhatsApp and Telegram.
  > Hmmm :( that's not any good. I don't have the device at hand and in all the devices that I tested the library against (20+) devices. Are you willing to investigate this issue and maybe come up with a PR?

- **Issue #110** (2017-06-26): **RecentEmoji not persisting when application is force close**
  *Symptoms*: Without dismissing EmojiPopup if we Force stop our application then recent emoji is not saving.  - Version of the library: compile 'com.vanniktech:emoji-ios:0.4.0' 
  **Post-Mortem & Fix Analysis**:
  > Could be fixed.
  > Decided that it's not worth the effort.

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

### Incident Patch 1: `69e998da` (2026-09-29)
**Commit Message**: Breaking: Drop simple unicode Emojis like ‼ instead only support rendered emojis like ‼️ (#1276)

**File**: `emoji-androidx-emoji2/src/commonMain/kotlin/com/vanniktech/emoji/androidxemoji2/category/ActivitiesCategoryChunk0.kt` (modified, +11/-77)
```diff
@@ -38,28 +38,10 @@ internal object ActivitiesCategoryChunk0 {
     AndroidxEmoji2("\ud83e\udde7", listOf("red_envelope")),
     AndroidxEmoji2("\ud83c\udf80", listOf("ribbon")),
     AndroidxEmoji2("\ud83c\udf81", listOf("gift")),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udf97",
-      shortcodes = listOf("reminder_ribbon"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udf97\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udf9f",
-      shortcodes = listOf("admission_tickets"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udf9f\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83c\udf97\ufe0f", listOf("reminder_ribbon")),
+    AndroidxEmoji2("\ud83c\udf9f\ufe0f", listOf("admission_tickets")),
     AndroidxEmoji2("\ud83c\udfab", listOf("ticket")),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udf96",
-      shortcodes = listOf("medal"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udf96\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83c\udf96\ufe0f", listOf("medal")),
     AndroidxEmoji2("\ud83c\udfc6", listOf("trophy")),
     AndroidxEmoji2("\ud83c\udfc5", listOf("sports_medal")),
     AndroidxEmoji2("\ud83e\udd47", listOf("first_place_medal")),
@@ -85,13 +67,7 @@ internal object ActivitiesCategoryChunk0 {
     AndroidxEmoji2("\ud83e\udd4b", listOf("martial_arts_uniform")),
     AndroidxEmoji2("\ud83e\udd45", listOf("goal_net")),
     AndroidxEmoji2("\u26f3", listOf("golf")),
-    AndroidxEmoji2(
-      unicode = "\u26f8",
-      shortcodes = listOf("ice_skate"),
-      variants = listOf(
-        AndroidxEmoji2("\u26f8\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\u26f8\ufe0f", listOf("ice_skate")),
     AndroidxEmoji2("\ud83c\udfa3", listOf("fishing_pole_and_fish")),
     AndroidxEmoji2("\ud83e\udd3f", listOf("diving_mask")),
     AndroidxEmoji2("\ud83c\udfbd", listOf("running_shirt_with_sash")),
@@ -106,66 +82,24 @@ internal object ActivitiesCategoryChunk0 {
     AndroidxEmoji2("\ud83d\udd2e", listOf("crystal_ball")),
     AndroidxEmoji2("\ud83e\ude84", listOf("magic_wand")),
     AndroidxEmoji2("\ud83c\udfae", listOf("video_game")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd79",
-      shortcodes = listOf("joystick"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd79\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\udd79\ufe0f", listOf("joystick")),
     AndroidxEmoji2("\ud83c\udfb0", listOf("slot_machine")),
     AndroidxEmoji2("\ud83c\udfb2", listOf("game_die")),
     AndroidxEmoji2("\ud83e\udde9", listOf("jigsaw")),
     AndroidxEmoji2("\ud83e\uddf8", listOf("teddy_bear")),
     AndroidxEmoji2("\ud83e\ude85", listOf("pinata")),
     AndroidxEmoji2("\ud83e\udea9", listOf("mirror_ball")),
     AndroidxEmoji2("\ud83e\ude86", listOf("nesting_dolls")),
-    AndroidxEmoji2(
-      unicode = "\u2660",
-      shortcodes = listOf("spades"),
-      variants = listOf(
-        AndroidxEmoji2("\u2660\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\u2665",
-      shortcodes = listOf("hearts"),
-      variants = listOf(
-        AndroidxEmoji2("\u2665\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\u2666",
-      shortcodes = listOf("diamonds"),
-      variants = listOf(
-        AndroidxEmoji2("\u2666\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\u2663",
-      shortcodes = listOf("clubs"),
-      variants = listOf(
-        AndroidxEmoji2("\u2663\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\u265f",
-      shortcodes = listOf("chess_pawn"),
-      variants = listOf(
-        AndroidxEmoji2("\u265f\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\u2660\ufe0f", listOf("spades")),
+    AndroidxEmoji2("\u2665\ufe0f", listOf("hearts")),
+    AndroidxEmoji2("\u2666\ufe0f", listOf("diamonds")),
+    AndroidxEmoji2("\u2663\ufe0f", listOf("clubs")),
+    AndroidxEmoji2("\u265f\ufe0f", listOf("chess_pawn")),
     AndroidxEmoji2("\ud83c\udccf", listOf("black_joker")),
     AndroidxEmoji2("\ud83c\udc04", listOf("mahjong")),
     AndroidxEmoji2("\ud83c\udfb4", listOf("flower_playing_cards")),
     AndroidxEmoji2("\ud83c\udfad", listOf("performing_arts")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\uddbc",
-      shortcodes = listOf("frame_with_picture"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\uddbc\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\uddbc\ufe0f", listOf("frame_with_picture")),
     AndroidxEmoji2("\ud83c\udfa8", listOf("art")),
     AndroidxEmoji2("\ud83e\uddf5", listOf("thread")),
     AndroidxEmoji2("\ud83e\udea1", listOf("sewing_needle")),
```

**File**: `emoji-androidx-emoji2/src/commonMain/kotlin/com/vanniktech/emoji/androidxemoji2/category/AnimalsAndNatureCategoryChunk0.kt` (modified, +3/-21)
```diff
@@ -72,24 +72,12 @@ internal object AnimalsAndNatureCategoryChunk0 {
     AndroidxEmoji2("\ud83d\udc39", listOf("hamster")),
     AndroidxEmoji2("\ud83d\udc30", listOf("rabbit")),
     AndroidxEmoji2("\ud83d\udc07", listOf("rabbit2")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udc3f",
-      shortcodes = listOf("chipmunk"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udc3f\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\udc3f\ufe0f", listOf("chipmunk")),
     AndroidxEmoji2("\ud83e\uddab", listOf("beaver")),
     AndroidxEmoji2("\ud83e\udd94", listOf("hedgehog")),
     AndroidxEmoji2("\ud83e\udd87", listOf("bat")),
     AndroidxEmoji2("\ud83d\udc3b", listOf("bear")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udc3b\u200d\u2744",
-      shortcodes = listOf("polar_bear"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udc3b\u200d\u2744\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\udc3b\u200d\u2744\ufe0f", listOf("polar_bear")),
     AndroidxEmoji2("\ud83d\udc28", listOf("koala")),
     AndroidxEmoji2("\ud83d\udc3c", listOf("panda_face")),
     AndroidxEmoji2("\ud83e\udda5", listOf("sloth")),
@@ -106,13 +94,7 @@ internal object AnimalsAndNatureCategoryChunk0 {
     AndroidxEmoji2("\ud83d\udc25", listOf("hatched_chick")),
     AndroidxEmoji2("\ud83d\udc26", listOf("bird")),
     AndroidxEmoji2("\ud83d\udc27", listOf("penguin")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd4a",
-      shortcodes = listOf("dove_of_peace"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd4a\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\udd4a\ufe0f", listOf("dove_of_peace")),
     AndroidxEmoji2("\ud83e\udd85", listOf("eagle")),
     AndroidxEmoji2("\ud83e\udd86", listOf("duck")),
     AndroidxEmoji2("\ud83e\udda2", listOf("swan")),
```

**File**: `emoji-androidx-emoji2/src/commonMain/kotlin/com/vanniktech/emoji/androidxemoji2/category/AnimalsAndNatureCategoryChunk1.kt` (modified, +4/-28)
```diff
@@ -43,20 +43,8 @@ internal object AnimalsAndNatureCategoryChunk1 {
     AndroidxEmoji2("\ud83d\udc1e", listOf("ladybug", "lady_beetle")),
     AndroidxEmoji2("\ud83e\udd97", listOf("cricket")),
     AndroidxEmoji2("\ud83e\udeb3", listOf("cockroach")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd77",
-      shortcodes = listOf("spider"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd77\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd78",
-      shortcodes = listOf("spider_web"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd78\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\udd77\ufe0f", listOf("spider")),
+    AndroidxEmoji2("\ud83d\udd78\ufe0f", listOf("spider_web")),
     AndroidxEmoji2("\ud83e\udd82", listOf("scorpion")),
     AndroidxEmoji2("\ud83e\udd9f", listOf("mosquito")),
     AndroidxEmoji2("\ud83e\udeb0", listOf("fly")),
@@ -66,13 +54,7 @@ internal object AnimalsAndNatureCategoryChunk1 {
     AndroidxEmoji2("\ud83c\udf38", listOf("cherry_blossom")),
     AndroidxEmoji2("\ud83d\udcae", listOf("white_flower")),
     AndroidxEmoji2("\ud83e\udeb7", listOf("lotus")),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udff5",
-      shortcodes = listOf("rosette"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udff5\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83c\udff5\ufe0f", listOf("rosette")),
     AndroidxEmoji2("\ud83c\udf39", listOf("rose")),
     AndroidxEmoji2("\ud83e\udd40", listOf("wilted_flower")),
     AndroidxEmoji2("\ud83c\udf3a", listOf("hibiscus")),
@@ -88,13 +70,7 @@ internal object AnimalsAndNatureCategoryChunk1 {
     AndroidxEmoji2("\ud83c\udf35", listOf("cactus")),
     AndroidxEmoji2("\ud83c\udf3e", listOf("ear_of_rice")),
     AndroidxEmoji2("\ud83c\udf3f", listOf("herb")),
-    AndroidxEmoji2(
-      unicode = "\u2618",
-      shortcodes = listOf("shamrock"),
-      variants = listOf(
-        AndroidxEmoji2("\u2618\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\u2618\ufe0f", listOf("shamrock")),
     AndroidxEmoji2("\ud83c\udf40", listOf("four_leaf_clover")),
     AndroidxEmoji2("\ud83c\udf41", listOf("maple_leaf")),
     AndroidxEmoji2("\ud83c\udf42", listOf("fallen_leaf")),
```

**File**: `emoji-androidx-emoji2/src/commonMain/kotlin/com/vanniktech/emoji/androidxemoji2/category/FlagsCategoryChunk0.kt` (modified, +4/-28)
```diff
@@ -24,34 +24,10 @@ internal object FlagsCategoryChunk0 {
     AndroidxEmoji2("\ud83d\udea9", listOf("triangular_flag_on_post")),
     AndroidxEmoji2("\ud83c\udf8c", listOf("crossed_flags")),
     AndroidxEmoji2("\ud83c\udff4", listOf("waving_black_flag")),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udff3",
-      shortcodes = listOf("waving_white_flag"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udff3\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udff3\u200d\ud83c\udf08",
-      shortcodes = listOf("rainbow-flag"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udff3\ufe0f\u200d\ud83c\udf08", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udff3\u200d\u26a7",
-      shortcodes = listOf("transgender_flag"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udff3\ufe0f\u200d\u26a7\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udff4\u200d\u2620",
-      shortcodes = listOf("pirate_flag"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udff4\u200d\u2620\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83c\udff3\ufe0f", listOf("waving_white_flag")),
+    AndroidxEmoji2("\ud83c\udff3\ufe0f\u200d\ud83c\udf08", listOf("rainbow-flag")),
+    AndroidxEmoji2("\ud83c\udff3\ufe0f\u200d\u26a7\ufe0f", listOf("transgender_flag")),
+    AndroidxEmoji2("\ud83c\udff4\u200d\u2620\ufe0f", listOf("pirate_flag")),
     AndroidxEmoji2("\ud83c\udde6\ud83c\udde8", listOf("flag-ac")),
     AndroidxEmoji2("\ud83c\udde6\ud83c\udde9", listOf("flag-ad")),
     AndroidxEmoji2("\ud83c\udde6\ud83c\uddea", listOf("flag-ae")),
```

**File**: `emoji-androidx-emoji2/src/commonMain/kotlin/com/vanniktech/emoji/androidxemoji2/category/FoodAndDrinkCategoryChunk0.kt` (modified, +1/-7)
```diff
@@ -45,13 +45,7 @@ internal object FoodAndDrinkCategoryChunk0 {
     AndroidxEmoji2("\ud83e\udd54", listOf("potato")),
     AndroidxEmoji2("\ud83e\udd55", listOf("carrot")),
     AndroidxEmoji2("\ud83c\udf3d", listOf("corn")),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udf36",
-      shortcodes = listOf("hot_pepper"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udf36\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83c\udf36\ufe0f", listOf("hot_pepper")),
     AndroidxEmoji2("\ud83e\uded1", listOf("bell_pepper")),
     AndroidxEmoji2("\ud83e\udd52", listOf("cucumber")),
     AndroidxEmoji2("\ud83e\udd6c", listOf("leafy_green")),
```

**File**: `emoji-androidx-emoji2/src/commonMain/kotlin/com/vanniktech/emoji/androidxemoji2/category/FoodAndDrinkCategoryChunk1.kt` (modified, +1/-7)
```diff
@@ -45,13 +45,7 @@ internal object FoodAndDrinkCategoryChunk1 {
     AndroidxEmoji2("\ud83e\uddc9", listOf("mate_drink")),
     AndroidxEmoji2("\ud83e\uddca", listOf("ice_cube")),
     AndroidxEmoji2("\ud83e\udd62", listOf("chopsticks")),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udf7d",
-      shortcodes = listOf("knife_fork_plate"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udf7d\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83c\udf7d\ufe0f", listOf("knife_fork_plate")),
     AndroidxEmoji2("\ud83c\udf74", listOf("fork_and_knife")),
     AndroidxEmoji2("\ud83e\udd44", listOf("spoon")),
     AndroidxEmoji2("\ud83d\udd2a", listOf("hocho", "knife")),
```

**File**: `emoji-androidx-emoji2/src/commonMain/kotlin/com/vanniktech/emoji/androidxemoji2/category/ObjectsCategoryChunk0.kt` (modified, +14/-98)
```diff
@@ -21,13 +21,7 @@ import com.vanniktech.emoji.androidxemoji2.AndroidxEmoji2
 internal object ObjectsCategoryChunk0 {
   internal val EMOJIS: List<AndroidxEmoji2> = listOf(
     AndroidxEmoji2("\ud83d\udc53", listOf("eyeglasses")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd76",
-      shortcodes = listOf("dark_sunglasses"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd76\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\udd76\ufe0f", listOf("dark_sunglasses")),
     AndroidxEmoji2("\ud83e\udd7d", listOf("goggles")),
     AndroidxEmoji2("\ud83e\udd7c", listOf("lab_coat")),
     AndroidxEmoji2("\ud83e\uddba", listOf("safety_vest")),
@@ -50,13 +44,7 @@ internal object ObjectsCategoryChunk0 {
     AndroidxEmoji2("\ud83d\udc5b", listOf("purse")),
     AndroidxEmoji2("\ud83d\udc5c", listOf("handbag")),
     AndroidxEmoji2("\ud83d\udc5d", listOf("pouch")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udecd",
-      shortcodes = listOf("shopping_bags"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udecd\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\udecd\ufe0f", listOf("shopping_bags")),
     AndroidxEmoji2("\ud83c\udf92", listOf("school_satchel")),
     AndroidxEmoji2("\ud83e\ude74", listOf("thong_sandal")),
     AndroidxEmoji2("\ud83d\udc5e", listOf("mans_shoe", "shoe")),
@@ -74,13 +62,7 @@ internal object ObjectsCategoryChunk0 {
     AndroidxEmoji2("\ud83c\udf93", listOf("mortar_board")),
     AndroidxEmoji2("\ud83e\udde2", listOf("billed_cap")),
     AndroidxEmoji2("\ud83e\ude96", listOf("military_helmet")),
-    AndroidxEmoji2(
-      unicode = "\u26d1",
-      shortcodes = listOf("helmet_with_white_cross"),
-      variants = listOf(
-        AndroidxEmoji2("\u26d1\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\u26d1\ufe0f", listOf("helmet_with_white_cross")),
     AndroidxEmoji2("\ud83d\udcff", listOf("prayer_beads")),
     AndroidxEmoji2("\ud83d\udc84", listOf("lipstick")),
     AndroidxEmoji2("\ud83d\udc8d", listOf("ring")),
@@ -97,27 +79,9 @@ internal object ObjectsCategoryChunk0 {
     AndroidxEmoji2("\ud83c\udfbc", listOf("musical_score")),
     AndroidxEmoji2("\ud83c\udfb5", listOf("musical_note")),
     AndroidxEmoji2("\ud83c\udfb6", listOf("notes")),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udf99",
-      shortcodes = listOf("studio_microphone"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udf99\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udf9a",
-      shortcodes = listOf("level_slider"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udf9a\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udf9b",
-      shortcodes = listOf("control_knobs"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udf9b\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83c\udf99\ufe0f", listOf("studio_microphone")),
+    AndroidxEmoji2("\ud83c\udf9a\ufe0f", listOf("level_slider")),
+    AndroidxEmoji2("\ud83c\udf9b\ufe0f", listOf("control_knobs")),
     AndroidxEmoji2("\ud83c\udfa4", listOf("microphone")),
     AndroidxEmoji2("\ud83c\udfa7", listOf("headphones")),
     AndroidxEmoji2("\ud83d\udcfb", listOf("radio")),
@@ -135,74 +99,26 @@ internal object ObjectsCategoryChunk0 {
     AndroidxEmoji2("\ud83e\ude89", listOf("harp")),
     AndroidxEmoji2("\ud83d\udcf1", listOf("iphone")),
     AndroidxEmoji2("\ud83d\udcf2", listOf("calling")),
-    AndroidxEmoji2(
-      unicode = "\u260e",
-      shortcodes = listOf("phone", "telephone"),
-      variants = listOf(
-        AndroidxEmoji2("\u260e\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\u260e\ufe0f", listOf("phone", "telephone")),
     AndroidxEmoji2("\ud83d\udcde", listOf("telephone_receiver")),
     AndroidxEmoji2("\ud83d\udcdf", listOf("pager")),
     AndroidxEmoji2("\ud83d\udce0", listOf("fax")),
     AndroidxEmoji2("\ud83d\udd0b", listOf("battery")),
     AndroidxEmoji2("\ud83e\udeab", listOf("low_battery")),
     AndroidxEmoji2("\ud83d\udd0c", listOf("electric_plug")),
     AndroidxEmoji2("\ud83d\udcbb", listOf("computer")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udda5",
-      shortcodes = listOf("desktop_computer"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udda5\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udda8",
-      shortcodes = listOf("printer"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udda8\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\u2328",
-      shortcodes = listOf("keyboard"),
-      variants = listOf(
-        AndroidxEmoji2("\u2328\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83d\uddb1",
-      shortcodes = listOf("three_button_mouse"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\uddb1\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      u
```

**File**: `emoji-androidx-emoji2/src/commonMain/kotlin/com/vanniktech/emoji/androidxemoji2/category/ObjectsCategoryChunk1.kt` (modified, +26/-182)
```diff
@@ -28,13 +28,7 @@ internal object ObjectsCategoryChunk1 {
     AndroidxEmoji2("\ud83d\udcfc", listOf("vhs")),
     AndroidxEmoji2("\ud83d\udd0d", listOf("mag")),
     AndroidxEmoji2("\ud83d\udd0e", listOf("mag_right")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd6f",
-      shortcodes = listOf("candle"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd6f\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\udd6f\ufe0f", listOf("candle")),
     AndroidxEmoji2("\ud83d\udca1", listOf("bulb")),
     AndroidxEmoji2("\ud83d\udd26", listOf("flashlight")),
     AndroidxEmoji2("\ud83c\udfee", listOf("izakaya_lantern", "lantern")),
@@ -52,22 +46,10 @@ internal object ObjectsCategoryChunk1 {
     AndroidxEmoji2("\ud83d\udcdc", listOf("scroll")),
     AndroidxEmoji2("\ud83d\udcc4", listOf("page_facing_up")),
     AndroidxEmoji2("\ud83d\udcf0", listOf("newspaper")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\uddde",
-      shortcodes = listOf("rolled_up_newspaper"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\uddde\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\uddde\ufe0f", listOf("rolled_up_newspaper")),
     AndroidxEmoji2("\ud83d\udcd1", listOf("bookmark_tabs")),
     AndroidxEmoji2("\ud83d\udd16", listOf("bookmark")),
-    AndroidxEmoji2(
-      unicode = "\ud83c\udff7",
-      shortcodes = listOf("label"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83c\udff7\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83c\udff7\ufe0f", listOf("label")),
     AndroidxEmoji2("\ud83d\udcb0", listOf("moneybag")),
     AndroidxEmoji2("\ud83e\ude99", listOf("coin")),
     AndroidxEmoji2("\ud83d\udcb4", listOf("yen")),
@@ -78,13 +60,7 @@ internal object ObjectsCategoryChunk1 {
     AndroidxEmoji2("\ud83d\udcb3", listOf("credit_card")),
     AndroidxEmoji2("\ud83e\uddfe", listOf("receipt")),
     AndroidxEmoji2("\ud83d\udcb9", listOf("chart")),
-    AndroidxEmoji2(
-      unicode = "\u2709",
-      shortcodes = listOf("email", "envelope"),
-      variants = listOf(
-        AndroidxEmoji2("\u2709\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\u2709\ufe0f", listOf("email", "envelope")),
     AndroidxEmoji2("\ud83d\udce7", listOf("e-mail")),
     AndroidxEmoji2("\ud83d\udce8", listOf("incoming_envelope")),
     AndroidxEmoji2("\ud83d\udce9", listOf("envelope_with_arrow")),
@@ -96,82 +72,22 @@ internal object ObjectsCategoryChunk1 {
     AndroidxEmoji2("\ud83d\udcec", listOf("mailbox_with_mail")),
     AndroidxEmoji2("\ud83d\udced", listOf("mailbox_with_no_mail")),
     AndroidxEmoji2("\ud83d\udcee", listOf("postbox")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\uddf3",
-      shortcodes = listOf("ballot_box_with_ballot"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\uddf3\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\u270f",
-      shortcodes = listOf("pencil2"),
-      variants = listOf(
-        AndroidxEmoji2("\u270f\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\u2712",
-      shortcodes = listOf("black_nib"),
-      variants = listOf(
-        AndroidxEmoji2("\u2712\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd8b",
-      shortcodes = listOf("lower_left_fountain_pen"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd8b\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd8a",
-      shortcodes = listOf("lower_left_ballpoint_pen"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd8a\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd8c",
-      shortcodes = listOf("lower_left_paintbrush"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd8c\ufe0f", emptyList()),
-      ),
-    ),
-    AndroidxEmoji2(
-      unicode = "\ud83d\udd8d",
-      shortcodes = listOf("lower_left_crayon"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\udd8d\ufe0f", emptyList()),
-      ),
-    ),
+    AndroidxEmoji2("\ud83d\uddf3\ufe0f", listOf("ballot_box_with_ballot")),
+    AndroidxEmoji2("\u270f\ufe0f", listOf("pencil2")),
+    AndroidxEmoji2("\u2712\ufe0f", listOf("black_nib")),
+    AndroidxEmoji2("\ud83d\udd8b\ufe0f", listOf("lower_left_fountain_pen")),
+    AndroidxEmoji2("\ud83d\udd8a\ufe0f", listOf("lower_left_ballpoint_pen")),
+    AndroidxEmoji2("\ud83d\udd8c\ufe0f", listOf("lower_left_paintbrush")),
+    AndroidxEmoji2("\ud83d\udd8d\ufe0f", listOf("lower_left_crayon")),
     AndroidxEmoji2("\ud83d\udcdd", listOf("memo", "pencil")),
     AndroidxEmoji2("\ud83d\udcbc", listOf("briefcase")),
     AndroidxEmoji2("\ud83d\udcc1", listOf("file_folder")),
     AndroidxEmoji2("\ud83d\udcc2", listOf("open_file_folder")),
-    AndroidxEmoji2(
-      unicode = "\ud83d\uddc2",
-      shortcodes = listOf("card_index_dividers"),
-      variants = listOf(
-        AndroidxEmoji2("\ud83d\uddc2\ufe0f", em
```

---

### Incident Patch 2: `da67114a` (2026-09-23)
**Commit Message**: fix(deps): update dependency me.tylerbwong.gradle.metalava:plugin to v0.5.1 (#1268)

**File**: `emoji/api/current.txt` (modified, +2/-2)
```diff
@@ -310,7 +310,7 @@ package com.vanniktech.emoji.recent {
 package com.vanniktech.emoji.search {
 
   public final class NoSearchEmoji implements com.vanniktech.emoji.search.SearchEmoji {
-    method public error.NonExistentClass search(String query);
+    method public java.util.List<com.vanniktech.emoji.search.SearchEmojiResult> search(String query);
     field public static final com.vanniktech.emoji.search.NoSearchEmoji INSTANCE;
   }
 
@@ -376,7 +376,7 @@ package com.vanniktech.emoji.variant {
   public final class NoVariantEmoji implements com.vanniktech.emoji.variant.VariantEmoji {
     method public void addVariant(com.vanniktech.emoji.Emoji newVariant);
     method public com.vanniktech.emoji.Emoji getVariant(com.vanniktech.emoji.Emoji desiredEmoji);
-    method public error.NonExistentClass getVariants(com.vanniktech.emoji.Emoji emoji);
+    method public java.util.List<com.vanniktech.emoji.Emoji> getVariants(com.vanniktech.emoji.Emoji emoji);
     method public void persist();
     field public static final com.vanniktech.emoji.variant.NoVariantEmoji INSTANCE;
   }
```

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ plugin-androidgradleplugin = { module = "com.android.tools.build:gradle", versio
 plugin-dokka = { module = "org.jetbrains.dokka:dokka-gradle-plugin", version = "2.2.0" }
 plugin-kotlin = { module = "org.jetbrains.kotlin:kotlin-gradle-plugin", version.ref = "kotlin" }
 plugin-licensee = { module = "app.cash.licensee:licensee-gradle-plugin", version = "1.14.1" }
-plugin-metalava = { module = "me.tylerbwong.gradle.metalava:plugin", version = "0.5.0" }
+plugin-metalava = { module = "me.tylerbwong.gradle.metalava:plugin", version = "0.5.1" }
 plugin-publish = { module = "com.vanniktech:gradle-maven-publish-plugin", version = "0.37.0" }
 robolectric = { module = "org.robolectric:robolectric", version = "4.17" }
 screengrab = { module = "tools.fastlane:screengrab", version = "2.1.1" }
```

---

### Incident Patch 3: `fb5a5523` (2026-09-23)
**Commit Message**: fix(deps): update dependency com.android.tools.build:gradle to v9.4.1 (#1270)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ minSdk = "23"
 compileSdk = "34"
 targetSdk = "34"
 
-androidgradleplugin = "9.4.0"
+androidgradleplugin = "9.4.1"
 kotlin = "2.4.20"
 ktlint = "1.8.0"
 
```

---

### Incident Patch 4: `8f21c286` (2026-09-23)
**Commit Message**: fix(deps): update dependency org.robolectric:robolectric to v4.17 (#1269)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ plugin-kotlin = { module = "org.jetbrains.kotlin:kotlin-gradle-plugin", version.
 plugin-licensee = { module = "app.cash.licensee:licensee-gradle-plugin", version = "1.14.1" }
 plugin-metalava = { module = "me.tylerbwong.gradle.metalava:plugin", version = "0.5.0" }
 plugin-publish = { module = "com.vanniktech:gradle-maven-publish-plugin", version = "0.37.0" }
-robolectric = { module = "org.robolectric:robolectric", version = "4.16.1" }
+robolectric = { module = "org.robolectric:robolectric", version = "4.17" }
 screengrab = { module = "tools.fastlane:screengrab", version = "2.1.1" }
 timber = { module = "com.jakewharton.timber:timber", version = "5.0.1" }
 ui = { module = "com.vanniktech:ui", version = "0.10.0" }
```

---

### Incident Patch 5: `45f01b07` (2026-09-08)
**Commit Message**: fix(deps): update dependency com.android.tools.build:gradle to v9.4.0 (#1263)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ minSdk = "23"
 compileSdk = "34"
 targetSdk = "34"
 
-androidgradleplugin = "9.3.2"
+androidgradleplugin = "9.4.0"
 kotlin = "2.4.20"
 ktlint = "1.8.0"
 
```

---

### Incident Patch 6: `fc4f3b5f` (2026-09-08)
**Commit Message**: fix(deps): update dependency com.vanniktech:gradle-maven-publish-plugin to v0.37.0 (#1225)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ plugin-dokka = { module = "org.jetbrains.dokka:dokka-gradle-plugin", version = "
 plugin-kotlin = { module = "org.jetbrains.kotlin:kotlin-gradle-plugin", version.ref = "kotlin" }
 plugin-licensee = { module = "app.cash.licensee:licensee-gradle-plugin", version = "1.14.1" }
 plugin-metalava = { module = "me.tylerbwong.gradle.metalava:plugin", version = "0.5.0" }
-plugin-publish = { module = "com.vanniktech:gradle-maven-publish-plugin", version = "0.35.0" }
+plugin-publish = { module = "com.vanniktech:gradle-maven-publish-plugin", version = "0.37.0" }
 robolectric = { module = "org.robolectric:robolectric", version = "4.16.1" }
 screengrab = { module = "tools.fastlane:screengrab", version = "2.1.1" }
 timber = { module = "com.jakewharton.timber:timber", version = "5.0.1" }
```

---

### Incident Patch 7: `62db3865` (2026-09-05)
**Commit Message**: fix(deps): update dependency org.jetbrains.dokka:dokka-gradle-plugin to v2.2.0 (#1244)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ leakcanary-android = { module = "com.squareup.leakcanary:leakcanary-android", ve
 material = { module = "com.google.android.material:material", version = "1.13.0" }
 plugin-android-cache-fix = { module = "org.gradle.android.cache-fix:org.gradle.android.cache-fix.gradle.plugin", version = "3.0.3" }
 plugin-androidgradleplugin = { module = "com.android.tools.build:gradle", version.ref = "androidgradleplugin" }
-plugin-dokka = { module = "org.jetbrains.dokka:dokka-gradle-plugin", version = "2.1.0" }
+plugin-dokka = { module = "org.jetbrains.dokka:dokka-gradle-plugin", version = "2.2.0" }
 plugin-kotlin = { module = "org.jetbrains.kotlin:kotlin-gradle-plugin", version.ref = "kotlin" }
 plugin-licensee = { module = "app.cash.licensee:licensee-gradle-plugin", version = "1.14.1" }
 plugin-metalava = { module = "me.tylerbwong.gradle.metalava:plugin", version = "0.5.0" }
```

---

### Incident Patch 8: `74266e69` (2026-09-05)
**Commit Message**: fix(deps): update dependency androidx.appcompat:appcompat to v1.8.0 (#1259)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ kotlin = "2.3.21"
 ktlint = "1.8.0"
 
 [libraries]
-androidx-appcompat = { module = "androidx.appcompat:appcompat", version = "1.7.1" }
+androidx-appcompat = { module = "androidx.appcompat:appcompat", version = "1.8.0" }
 androidx-cardview = { module = "androidx.cardview:cardview", version = "1.0.0" }
 androidx-emoji-appcompat = { module = "androidx.emoji:emoji-appcompat", version = "1.2.0" }
 androidx-emoji2 = { module = "androidx.emoji2:emoji2", version = "1.5.0" }
```

---

### Incident Patch 9: `a4c5a319` (2026-05-25)
**Commit Message**: fix(deps): update dependency com.vanniktech:junit4-android-integration-rules to v0.4.0 (#1254)

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ androidx-test-ext = { module = "androidx.test.ext:junit", version = "1.3.0" }
 androidx-test-rules = { module = "androidx.test:rules", version = "1.7.0" }
 espressocoreutils = { module = "com.vanniktech:espresso-core-utils", version = "0.4.0" }
 falcon = { module = "com.jraska:falcon", version = "2.2.0" }
-junitintegrationrules = { module = "com.vanniktech:junit4-android-integration-rules", version = "0.3.0" }
+junitintegrationrules = { module = "com.vanniktech:junit4-android-integration-rules", version = "0.4.0" }
 kotlin-test = { module = "org.jetbrains.kotlin:kotlin-test", version.ref = "kotlin" }
 kotlin-test-junit = { module = "org.jetbrains.kotlin:kotlin-test-junit", version.ref = "kotlin" }
 leakcanary-android = { module = "com.squareup.leakcanary:leakcanary-android", version = "2.14" }
```

---

### Incident Patch 10: `6cca98bf` (2026-04-25)
**Commit Message**: fix(deps): update kotlin monorepo to v2.3.21 (#1248)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ compileSdk = "34"
 targetSdk = "34"
 
 androidgradleplugin = "8.13.2"
-kotlin = "2.3.20"
+kotlin = "2.3.21"
 ktlint = "1.8.0"
 
 [libraries]
```

---

### Incident Patch 11: `bf5babdc` (2026-03-25)
**Commit Message**: fix(deps): update dependency androidx.emoji:emoji-appcompat to v1.2.0 (#1220)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ ktlint = "1.8.0"
 [libraries]
 androidx-appcompat = { module = "androidx.appcompat:appcompat", version = "1.7.1" }
 androidx-cardview = { module = "androidx.cardview:cardview", version = "1.0.0" }
-androidx-emoji-appcompat = { module = "androidx.emoji:emoji-appcompat", version = "1.1.0" }
+androidx-emoji-appcompat = { module = "androidx.emoji:emoji-appcompat", version = "1.2.0" }
 androidx-emoji2 = { module = "androidx.emoji2:emoji2", version = "1.5.0" }
 androidx-recyclerview = { module = "androidx.recyclerview:recyclerview", version = "1.3.2" }
 androidx-test-espresso = { module = "androidx.test.espresso:espresso-core", version = "3.7.0" }
```

---

### Incident Patch 12: `02d2f9d9` (2026-03-25)
**Commit Message**: fix(deps): update kotlin monorepo to v2.3.20 (#1235)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ compileSdk = "34"
 targetSdk = "34"
 
 androidgradleplugin = "8.13.2"
-kotlin = "2.3.10"
+kotlin = "2.3.20"
 ktlint = "1.8.0"
 
 [libraries]
```

---

### Incident Patch 13: `1327cb90` (2026-03-25)
**Commit Message**: Bug fix: Don't double lock when destroying EmojiManager. (#1242)

**File**: `.github/workflows/build.yml` (modified, +1/-1)
```diff
@@ -28,4 +28,4 @@ jobs:
           java-version: ${{ matrix.java_version }}
 
       - name: Build with Gradle
-        run: ./gradlew licensee jvmTest ktlint testDebug build --stacktrace -x iosSimulatorArm64Test
+        run: ./gradlew licensee jvmTest ktlint testDebug build --stacktrace
```

**File**: `.github/workflows/publish-release.yml` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ jobs:
         uses: gradle/gradle-build-action@v3
 
       - name: Publish release
-        run: ./gradlew publishAllPublicationsToMavenCentralRepository -x iosSimulatorArm64Test
+        run: ./gradlew publishAllPublicationsToMavenCentralRepository
         env:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.SONATYPE_NEXUS_USERNAME }}
           ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.SONATYPE_NEXUS_PASSWORD }}
```

**File**: `.github/workflows/publish-snapshot.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ jobs:
           echo "VERSION_NAME=$(cat gradle.properties | grep -w "VERSION_NAME" | cut -d'=' -f2)" >> $GITHUB_ENV
 
       - name: Publish snapshot
-        run: ./gradlew publishAllPublicationsToMavenCentralRepository -x iosSimulatorArm64Test
+        run: ./gradlew publishAllPublicationsToMavenCentralRepository
         if: endsWith(env.VERSION_NAME, '-SNAPSHOT')
         env:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.SONATYPE_NEXUS_USERNAME }}
```

**File**: `emoji/src/commonMain/kotlin/com/vanniktech/emoji/EmojiManager.kt` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ object EmojiManager {
    */
   @JvmStatic fun destroy() {
     LOCK.use {
-      release()
+      emojiProvider?.release()
       emojiMap.clear()
       emojiProvider = null
       categories = null
```

---

### Incident Patch 14: `54c91282` (2026-03-17)
**Commit Message**: Publishing: Use mac-os-latest to fix KT-84975 (#1236)

**File**: `.github/workflows/build.yml` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ on: [push, pull_request, merge_group]
 jobs:
   build:
     name: JDK ${{ matrix.java_version }}
-    runs-on: ubuntu-latest
+    runs-on: macos-latest
 
     strategy:
       matrix:
@@ -28,4 +28,4 @@ jobs:
           java-version: ${{ matrix.java_version }}
 
       - name: Build with Gradle
-        run: ./gradlew licensee jvmTest ktlint testDebug build --stacktrace
+        run: ./gradlew licensee jvmTest ktlint testDebug build --stacktrace -x iosSimulatorArm64Test
```

**File**: `.github/workflows/publish-release.yml` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ on:
 jobs:
   publish:
 
-    runs-on: ubuntu-latest
+    runs-on: macos-latest
     if: github.repository == 'vanniktech/Emoji'
 
     steps:
@@ -25,7 +25,7 @@ jobs:
         uses: gradle/gradle-build-action@v3
 
       - name: Publish release
-        run: ./gradlew publishAllPublicationsToMavenCentralRepository
+        run: ./gradlew publishAllPublicationsToMavenCentralRepository -x iosSimulatorArm64Test
         env:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.SONATYPE_NEXUS_USERNAME }}
           ORG_GRADLE_PROJECT_mavenCentralPassword: ${{ secrets.SONATYPE_NEXUS_PASSWORD }}
```

**File**: `.github/workflows/publish-snapshot.yml` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ on:
 jobs:
   publish:
 
-    runs-on: ubuntu-latest
+    runs-on: macos-latest
     if: github.repository == 'vanniktech/Emoji'
 
     steps:
@@ -29,7 +29,7 @@ jobs:
           echo "VERSION_NAME=$(cat gradle.properties | grep -w "VERSION_NAME" | cut -d'=' -f2)" >> $GITHUB_ENV
 
       - name: Publish snapshot
-        run: ./gradlew publishAllPublicationsToMavenCentralRepository
+        run: ./gradlew publishAllPublicationsToMavenCentralRepository -x iosSimulatorArm64Test
         if: endsWith(env.VERSION_NAME, '-SNAPSHOT')
         env:
           ORG_GRADLE_PROJECT_mavenCentralUsername: ${{ secrets.SONATYPE_NEXUS_USERNAME }}
```

---

### Incident Patch 15: `177adef3` (2026-03-10)
**Commit Message**: fix(deps): update kotlin monorepo to v2.3.10 (#1177)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ compileSdk = "34"
 targetSdk = "34"
 
 androidgradleplugin = "8.8.2"
-kotlin = "2.1.21"
+kotlin = "2.3.10"
 ktlint = "1.7.1"
 
 [libraries]
```

#### Recent Merged Pull Requests:
- **PR #1277** (closed): docs: add interactive web references (@tabbymarshlwio0-rgb)
- **PR #1276** (2026-09-29): Breaking: Drop simple unicode Emojis like ‼ instead only support rendered emojis like ‼️ (@vanniktech)
- **PR #1275** (2026-09-29): chore(deps): update gradle to v9.8.0 (@renovate[bot])
- **PR #1274** (closed): SearchEmojiManager: Pick single variant of the Emoji if there is only one. Emojis like chains or bangbang where broken before. (@vanniktech)
- **PR #1273** (2026-09-23): SearchInPlaceTrait: Allow dash - symbol. This allows to search for flags like flag-pe (@vanniktech)
- **PR #1270** (2026-09-23): fix(deps): update dependency com.android.tools.build:gradle to v9.4.1 - autoclosed (@renovate[bot])
- **PR #1269** (2026-09-23): fix(deps): update dependency org.robolectric:robolectric to v4.17 (@renovate[bot])
- **PR #1268** (2026-09-23): fix(deps): update dependency me.tylerbwong.gradle.metalava:plugin to v0.5.1 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
