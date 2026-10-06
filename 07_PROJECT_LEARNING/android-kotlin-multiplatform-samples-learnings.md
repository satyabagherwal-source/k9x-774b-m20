# Forensic Learning Record (Deep Inspection): android/kotlin-multiplatform-samples

> **Canonical Artifact**: `07_PROJECT_LEARNING/android-kotlin-multiplatform-samples-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/android/kotlin-multiplatform-samples](https://github.com/android/kotlin-multiplatform-samples))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:03:25.828Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `android/kotlin-multiplatform-samples`
- **Description**: Samples showcasing the Kotlin Multiplatform Jetpack libraries
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1306 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Fruitties/shared/src/iosMain/kotlin/com/example/fruitties/di/viewmodel/ViewModelStoreUtil.kt`
```
package com.example.fruitties.di.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.CreationExtras
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ObjCClass
import kotlinx.cinterop.getOriginalKotlinClass
import kotlin.reflect.KClass

/**
 * This function allows retrieving any ViewModel from Swift Code with generics.
 * We only get [ObjCClass] type for the [modelClass], because the interop between Kotlin and Swift
 * code doesn't preserve the generic class, but we can retrieve the original KClass in Kotlin.
 */
@Suppress("unused") // Android Studio is not aware of iOS usage.
@OptIn(BetaInteropApi::class)
@Throws(IllegalStateException::class)
fun ViewModelStoreOwner.viewModel(
    modelClass: ObjCClass,
    factory: ViewModelProvider.Factory,
    key: String?,
    extras: CreationExtras? = null,
): ViewModel {
    @Suppress("UNCHECKED_CAST")
    val vmClass = getOriginalKotlinClass(modelClass) as? KClass<ViewModel>
        ?: error("modelClass isn't a ViewModel type")
    val provider = ViewModelProvider.create(this, factory, extras ?: CreationExtras.Empty)
    return key?.let { provider[key, vmClass] } ?: provider[vmClass]
}

```

### Core Architecture Module: `Fruitties/androidApp/src/main/java/com/example/fruitties/android/FruittiesAndroidApp.kt`
```
/*
 * Copyright 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.example.fruitties.android

import android.app.Application
import androidx.compose.runtime.staticCompositionLocalOf
import com.example.fruitties.di.AppContainer
import com.example.fruitties.di.Factory

class FruittiesAndroidApp : Application() {
    /** AppContainer instance used by the rest of classes to obtain dependencies */
    lateinit var container: AppContainer

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(Factory(this))
    }
}

/**
 * Allows retrieving the AppContainer, which represents a DI graph everywhere from a composable.
 * Because the [AppContainer] is effectively a singleton, we can use static composition local,
 * because it won't change during the app execution.
 */
val LocalAppContainer =
    staticCompositionLocalOf<AppContainer> { error("No AppContainer provided!") }

```

### Core Architecture Module: `Fruitties/androidApp/src/main/java/com/example/fruitties/android/MainActivity.kt`
```
/*
 * Copyright 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.example.fruitties.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import com.example.fruitties.android.ui.CartScreen
import com.example.fruitties.android.ui.FruittieScreen
import com.example.fruitties.android.ui.FruittiesTheme
import com.example.fruitties.android.ui.ListScreen
import kotlinx.serialization.Serializable

@Serializable
data object ListScreenKey : NavKey

@Serializable
data object CartScreenKey : NavKey

@Serializable
data class FruittieScreenKey(
    val id: Long,
) : NavKey

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            CompositionLocalProvider(
                LocalAppContainer provides (this.applicationContext as FruittiesAndroidApp).container,
            ) {
                FruittiesTheme {
                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colorScheme.background,
                    ) {
                        NavApp()
                    }
                }
            }
        }
    }
}

@Composable
fun NavApp() {
    val backStack = rememberNavBackStack(ListScreenKey)

    NavDisplay(
        backStack = backStack,
        entryDecorators = listOf(
            rememberSaveableStateHolderNavEntryDecorator(),
            rememberViewModelStoreNavEntryDecorator(),
        ),
        entryProvider = entryProvider {
            entry<ListScreenKey> {
                ListScreen(
                    onFruittieClick = {
                        backStack.add(FruittieScreenKey(it.id))
                    },
                    onClickViewCart = {
                        backStack.add(CartScreenKey)
                    },
                )
            }
            entry<FruittieScreenKey> {
                FruittieScreen(
                    fruittieId = it.id,
                    onNavBarBack = {
                        backStack.removeIf { it is FruittieScreenKey }
                    },
                )
            }

            entry<CartScreenKey> {
                CartScreen(
                    onNavBarBack = {
                        backStack.removeIf { it is CartScreenKey }
                    },
                )
            }
        },
    )
}

```

### Core Architecture Module: `Fruitties/androidApp/src/main/java/com/example/fruitties/android/ui/CartScreen.kt`
```
/*
 * Copyright 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.example.fruitties.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsBottomHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.fruitties.android.LocalAppContainer
import com.example.fruitties.android.R
import com.example.fruitties.model.CartItemDetails
import com.example.fruitties.model.Fruittie
import com.example.fruitties.viewmodel.CartUiState
import com.example.fruitties.viewmodel.CartViewModel

@Composable
fun CartScreen(
    onNavBarBack: () -> Unit,
    viewModel: CartViewModel = viewModel(factory = LocalAppContainer.current.cartViewModelFactory),
) {
    val cartState by viewModel.cartUiState.collectAsState()

    CartScreen(
        onNavBarBack = onNavBarBack,
        cartState = cartState,
        increaseCountClick = viewModel::increaseCountClick,
        decreaseCountClick = viewModel::decreaseCountClick,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartScreen(
    onNavBarBack: () -> Unit,
    cartState: CartUiState,
    decreaseCountClick: (CartItemDetails) -> Unit,
    increaseCountClick: (CartItemDetails) -> Unit,
) {
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                navigationIcon = {
                    IconButton(onClick = onNavBarBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Navigate back",
                        )
                    }
                },
                title = {
                    Text(text = stringResource(R.string.cart))
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    scrolledContainerColor = MaterialTheme.colorScheme.primary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
        contentWindowInsets = WindowInsets.safeDrawing.only(
            // Do not include Bottom so scrolled content is drawn below system bars.
            // Include Horizontal because some devices have camera cutouts on the side.
            WindowInsetsSides.Top + WindowInsetsSides.Horizontal,
        ),
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .padding(paddingValues)
                .consumeWindowInsets(paddingValues)
                .padding(16.dp),
        ) {
            val cartItemCount = cartState.totalItemCount
            Text(
                text = stringResource(R.string.cart_has_items, cartItemCount),
            )
            HorizontalDivider()
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
            ) {
                items(cartState.cartDetails) { cartItem ->
                    CartItem(
                        cartItem = cartItem,
                        decreaseCountClick = decreaseCountClick,
                        increaseCountClick = increaseCountClick,
                    )
                }
                item {
                    Spacer(
                        Modifier.windowInsetsBottomHeight(
                            WindowInsets.systemBars,
                        ),
                    )
                }
            }
        }
    }
}

@Composable
fun CartItem(
    cartItem: CartItemDetails,
    increaseCountClick: (CartItemDetails) -> Unit,
    decreaseCountClick: (CartItemDetails) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = "${cartItem.count}x")
        Spacer(Modifier.width(8.dp))
        Text(text = cartItem.fruittie.name)
        Spacer(Modifier.weight(1f))
        FilledIconButton(
            onClick = { decreaseCountClick(cartItem) },
            colors = IconButtonDefaults.filledIconButtonColors(containerColor = MaterialTheme.colorScheme.error),
        ) {
            Text(
                text = "-",
                color = MaterialTheme.colorScheme.onPrimary,
                textAlign = TextAlign.Center,
            )
        }
        FilledIconButton(
            onClick = { increaseCountClick(cartItem) },
            colors = IconButtonDefaults.filledIconButtonColors(containerColor = Color.Green),
        ) {
            Text(
                text = "+",
                color = MaterialTheme.colorScheme.onPrimary,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Preview
@Composable
private fun CartScreenPreview() {
    FruittiesTheme {
        CartScreen(
            onNavBarBack = {},
            cartState = CartUiState(
                cartDetails = listOf(
                    CartItemDetails(
                        fruittie = Fruittie(
                            name = "Banana",
                            fullName = "Banana Banana",
                            calories = "100",
                        ),
                        count = 4,
                    ),
                    CartItemDetails(
                        fruittie = Fruittie(
                            name = "Orange",
                            fullName = "Orange Orange",
                            calories = "100",
                        ),
                        count = 1,
                    ),
                    CartItemDetails(
                        fruittie = Fruittie(
                            name = "Apple",
                            fullName = "Apple Apple",
                            calories = "100",
                        ),
                        count = 100,
                    ),
                ),
            ),
            decreaseCountClick = {},
            increaseCountClick = {},
        )
    }
}

@Preview
@Composable
private fun CartItemPreview() {
    FruittiesTheme {
        CartItem(
            cartItem = CartItemDetails(
                fruittie = Fruittie(
                    name = "Banana",
                    fullName = "Banana Banana",
                    calories = "100",
                ),
                count = 4,
            ),
            increaseCountClick = {},
            decreaseCountClick = {},
        )
    }
}

```

### Core Architecture Module: `Fruitties/androidApp/src/main/java/com/example/fruitties/android/ui/FruittieScreen.kt`
```
package com.example.fruitties.android.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.fruitties.android.LocalAppContainer
import com.example.fruitties.android.R
import com.example.fruitties.model.Fruittie
import com.example.fruitties.viewmodel.FruittieViewModel
import com.example.fruitties.viewmodel.FruittieViewModel.Companion.FRUITTIE_ID_KEY
import com.example.fruitties.viewmodel.creationExtras

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FruittieScreen(
    fruittieId: Long,
    onNavBarBack: () -> Unit,
    viewModel: FruittieViewModel = viewModel(
        key = "fruittie_$fruittieId",
        factory = LocalAppContainer.current.fruittieViewModelFactory,
        extras = creationExtras {
            set(FRUITTIE_ID_KEY, fruittieId)
        },
    ),
) {
    val state = viewModel.state.collectAsState().value

    FruittieScreen(
        state = state,
        onNavBarBack = onNavBarBack,
        addToCart = { viewModel.addToCart(it) },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FruittieScreen(
    state: FruittieViewModel.State,
    addToCart: (Fruittie) -> Unit,
    onNavBarBack: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        (state as? FruittieViewModel.State.Content)?.fruittie?.name
                            ?: stringResource(R.string.loading),
                    )
                },
                actions = {
                    val inCart = (state as? FruittieViewModel.State.Content)?.inCart ?: 0
                    Text(stringResource(R.string.in_cart, inCart))
                    Spacer(Modifier.width(8.dp))
                },
                navigationIcon = {
                    IconButton(onClick = onNavBarBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.navigate_back),
                        )
                    }
                },
            )
        },
        floatingActionButton = {
            // Check if state is loaded
            if (state !is FruittieViewModel.State.Content) return@Scaffold

            FloatingActionButton(
                shape = MaterialTheme.shapes.extraLarge,
                onClick = { addToCart(state.fruittie) },
            ) {
                Row(
                    modifier = Modifier.padding(
                        horizontal = 16.dp,
                    ),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.ShoppingCart,
                        contentDescription = null,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(text = stringResource(R.string.add_to_cart))
                }
            }
        },
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .padding(it)
                .fillMaxSize(),
        ) {
            when (state) {
                FruittieViewModel.State.Loading -> CircularProgressIndicator()
                is FruittieViewModel.State.Content -> {
                    Text(state.fruittie.fullName)
                    Text(state.fruittie.calories)
                }
            }
        }
    }
}

```

### Core Architecture Module: `Fruitties/androidApp/src/main/java/com/example/fruitties/android/ui/FruittiesTheme.kt`
```
/*
 * Copyright 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.example.fruitties.android.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun FruittiesTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) {
        darkColorScheme(
            primary = Color(0xFFBB86FC),
            secondary = Color(0xFF03DAC5),
            tertiary = Color(0xFF3700B3),
        )
    } else {
        lightColorScheme(
            primary = Color(0xFF6200EE),
            secondary = Color(0xFF03DAC5),
            tertiary = Color(0xFF3700B3),
        )
    }
    val typography = Typography(
        bodyMedium = TextStyle(
            fontFamily = FontFamily.Default,
            fontWeight = FontWeight.Normal,
            fontSize = 16.sp,
        ),
    )
    val shapes = Shapes(
        small = RoundedCornerShape(4.dp),
        medium = RoundedCornerShape(4.dp),
        large = RoundedCornerShape(0.dp),
    )

    MaterialTheme(
        colorScheme = colors,
        typography = typography,
        shapes = shapes,
        content = content,
    )
}

```

### Core Architecture Module: `Fruitties/androidApp/src/main/java/com/example/fruitties/android/ui/ListScreen.kt`
```
/*
 * Copyright 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.example.fruitties.android.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.fruitties.android.LocalAppContainer
import com.example.fruitties.android.R
import com.example.fruitties.model.Fruittie
import com.example.fruitties.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListScreen(
    onClickViewCart: () -> Unit,
    onFruittieClick: (Fruittie) -> Unit,
    viewModel: MainViewModel = viewModel(
        factory = LocalAppContainer.current.mainViewModelFactory,
    ),
) {
    val uiState by viewModel.homeUiState.collectAsState()
    val topAppBarScrollBehavior = TopAppBarDefaults.enterAlwaysScrollBehavior()
    Scaffold(
        topBar = {
            LargeTopAppBar(
                scrollBehavior = topAppBarScrollBehavior,
                title = {
                    Text(text = stringResource(R.string.frutties))
                },
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onClickViewCart,
                shape = MaterialTheme.shapes.extraLarge,
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.ShoppingCart,
                        contentDescription = null,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(text = stringResource(R.string.view_cart, uiState.cartItemCount))
                }
            }
        },
    ) { paddingValues ->
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 72.dp),
            modifier = Modifier
                .nestedScroll(topAppBarScrollBehavior.nestedScrollConnection)
                .padding(paddingValues)
                .consumeWindowInsets(paddingValues),
        ) {
            items(items = uiState.fruitties, key = { it.id }) { item ->
                FruittieItem(
                    item = item,
                    onClick = onFruittieClick,
                    onAddToCart = viewModel::addItemToCart,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
fun FruittieItem(
    item: Fruittie,
    onClick: (fruittie: Fruittie) -> Unit,
    onAddToCart: (fruittie: Fruittie) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .clickable {
                onClick(item)
            }.padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = item.name,
                color = MaterialTheme.colorScheme.onBackground,
                style = MaterialTheme.typography.titleLarge,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = item.fullName,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(modifier = Modifier.weight(1f))
        Row(
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(onClick = { onAddToCart(item) }) {
                Text(stringResource(R.string.add))
            }
        }
    }
}

@Preview
@Composable
fun ItemPreview() {
    FruittieItem(
        Fruittie(name = "Fruit", fullName = "Fruitus Mangorus", calories = "240"),
        onAddToCart = {},
        onClick = {},
    )
}

```

### Core Architecture Module: `Fruitties/iosApp/iosApp/IOSViewModelStoreOwner.swift`
```
import SwiftUI
import shared

/// A ViewModelStoreOwner specifically for iOS to be an ObservableObject.
class IOSViewModelStoreOwner: ObservableObject, ViewModelStoreOwner {

    var viewModelStore = ViewModelStore()

    /// This function allows retrieving the androidx ViewModel from the store.
    func viewModel<T: ViewModel>(
        key: String? = nil,
        factory: ViewModelProviderFactory,
        extras: CreationExtras? = nil
    ) -> T {
        do {
            return try viewModel(
                modelClass: T.self,
                factory: factory,
                key: key,
                extras: extras
            ) as! T
        } catch {
            fatalError("Failed to create ViewModel of type \(T.self)")
        }
    }

    /// This can be called from outside when using the `ViewModelStoreOwnerProvider`
    func clear() {
        viewModelStore.clear()
    }

    /// This is called when this class is used as a `@StateObject`
    deinit {
        viewModelStore.clear()
    }
}

```

### Core Architecture Module: `Fruitties/iosApp/iosApp/ObservableValueWrapper.swift`
```
import Combine
import SwiftUI
import shared

/// A generic wrapper that makes any `Value` type observable by SwiftUI.
///
/// Use this to wrap non-`ObservableObject` types when their changes need to update SwiftUI views.
class ObservableValueWrapper<Value>: ObservableObject {

    /// The wrapped value. Changes trigger SwiftUI view updates.
    @Published var value: Value

    /// Initializes the wrapper with an initial value.
    init(value: Value) {
        self.value = value
    }
}

```

### Core Architecture Module: `Fruitties/iosApp/iosApp/ViewModelStoreOwnerProvider.swift`
```
import SwiftUI
import shared

/// A SwiftUI `View` that provides a `ViewModelStoreOwner` to its content.
///
/// Manages the lifecycle of `ViewModel` instances, scoping them to this view hierarchy.
/// Clears the associated `ViewModelStore` when the provider disappears.
struct ViewModelStoreOwnerProvider<Content: View>: View {
    @StateObject private var viewModelStoreOwner = IOSViewModelStoreOwner()
    
    private let content: Content

    /// Initializes the provider with its content, creating a new `IOSViewModelStoreOwner`.
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .environmentObject(viewModelStoreOwner)
            .onDisappear {
                viewModelStoreOwner.clear()
            }
    }
}



```

### Core Architecture Module: `Fruitties/iosApp/iosApp/iOSApp.swift`
```
/*
 * Copyright 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 20.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import SwiftUI
import shared

@main
struct iOSApp: App {
    /// The application's dependency container, wrapped for SwiftUI observation.
    let appContainer: ObservableValueWrapper<AppContainer>

    init() {
        self.appContainer = ObservableValueWrapper<AppContainer>(
            value: AppContainer(factory: Factory())
        )
    }

    var body: some Scene {
        WindowGroup {
            /// Provides the root `ViewModelStoreOwner` to the environment, making it accessible to all child views.
            /// Nested `ViewModelStoreOwnerProvider` instances can create additional, scoped ViewModel stores.
            ViewModelStoreOwnerProvider {
                ContentView()
            }
            .environmentObject(appContainer)
        }
    }
}

```

### Core Architecture Module: `Fruitties/iosApp/iosApp/ui/CartView.swift`
```
/*
 * Copyright 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Foundation
import SwiftUI
import shared

struct CartView: View {
    /// Injects the `IOSViewModelStoreOwner` from the environment, which manages the lifecycle of `ViewModel` instances.
    @StateObject var viewModelStoreOwner = IOSViewModelStoreOwner()

    /// Injects the `AppContainer` from the environment, providing access to application-wide dependencies.
    @EnvironmentObject var appContainer: ObservableValueWrapper<AppContainer>

    var body: some View {
        /// Retrieves the `CartViewModel` instance using the `viewModelStoreOwner`.
        /// The `CartViewModel.Factory` and `creationExtras` are provided to enable dependency injection
        /// and proper initialization of the ViewModel with its required `AppContainer`.
        let cartViewModel: CartViewModel = viewModelStoreOwner.viewModel(
            factory: appContainer.value.cartViewModelFactory
        )

        /// Observes the `cartUiState` `StateFlow` from the `CartViewModel` using SKIE's `Observing` utility.
        /// This allows SwiftUI to react to changes in the cart's UI state.
        /// For more details, refer to: https://skie.touchlab.co/features/flows-in-swiftui
        Observing(cartViewModel.cartUiState) { cartUIState in
            VStack {
                CartDetailsView(cartViewModel: cartViewModel)
                Spacer()
            }
            .navigationTitle("Cart")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Observing(cartViewModel.cartUiState) { cartUIState in
                        let total = cartUIState.totalItemCount
                        Text("Cart has \(total) items")
                    }
                }
            }
        }
    }
}

struct CartDetailsView: View {
    let cartViewModel: CartViewModel

    var body: some View {
        /// Observes the `cartUiState` `StateFlow` from the `CartViewModel` using SKIE's `Observing` utility.
        /// This allows SwiftUI to react to changes in the cart's UI state.
        /// For more details, refer to: https://skie.touchlab.co/features/flows-in-swiftui
        Observing(self.cartViewModel.cartUiState) { cartUIState in
            List {
                ForEach(cartUIState.cartDetails, id: \.fruittie.id) { item in
                    HStack {
                        Text("\(item.count)x \(item.fruittie.name)")
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Spacer()
                        Button(action: {
                            self.cartViewModel.decreaseCountClick(
                                cartItem: item
                            )
                        }) {
                            Image(systemName: "minus.circle.fill")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.plain)

                        Button(action: {
                            self.cartViewModel.increaseCountClick(
                                cartItem: item
                            )
                        }) {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(.green)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .listStyle(.inset)
            .animation(.default, value: cartUIState.cartDetails)
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #109** (2025-11-21): **chore(deps): update dependency com.google.devtools.ksp 2.3.2 to v2.3.3**
  *Symptoms*: This PR contains the following updates:  | Package | Change | Age | Confidence | |---|---|---|---| | [com.google.devtools.ksp](https://goo.gle/ksp) ([source](https://redirect.github.com/google/ksp)) | `2.3.2` -> `2.3.3` | [![age](https://developer.mend.io/api/mc/badges/age/maven/com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin/2.3.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin/2.3.2/2.3.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) |  ---  ### Release Notes  <details> <summary>google/ksp (com.google.devtools.ksp)</summary>  ### [`v2.3.3`](https://redirect.github.com/google/ksp/releases/tag/2.3.3)  [Compare Source](https://redirect.github.com/google/ksp/compare/2.3.2...2.3.3)  ##### What's Changed  - Migrate away from a deprecated compilerOptions KGP API [#&#8203;2703](https://redirect.github.com/google/ksp/issues/2703)  ##### Contributors  - Thanks to everyone who reported bugs and participated in discussions!  **Full Changelog**: <https://github.com/google/ksp/compare/2.3.2...2.3.3>  </details>  ---  ### Configuration  📅 **Schedule**: Branch creation - Between 12:00 AM and 03:59 AM ( * 0-3 * * * ) (UTC), Automerge - At any time (no schedule defined).  🚦 **Automerge**: Enabled.  ♻ **Rebasing**: Whenever PR is behind base branch, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR 

- **Issue #108** (2025-11-15): **fix(deps): update kotlin dependencies 0.10.7 to v0.10.8**
  *Symptoms*: This PR contains the following updates:  | Package | Change | Age | Confidence | |---|---|---|---| | [co.touchlab.skie](https://skie.touchlab.co) ([source](https://redirect.github.com/touchlab/SKIE)) | `0.10.7` -> `0.10.8` | [![age](https://developer.mend.io/api/mc/badges/age/maven/co.touchlab.skie:co.touchlab.skie.gradle.plugin/0.10.8?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/co.touchlab.skie:co.touchlab.skie.gradle.plugin/0.10.7/0.10.8?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [co.touchlab.skie:configuration-annotations](https://skie.touchlab.co) ([source](https://redirect.github.com/touchlab/SKIE)) | `0.10.7` -> `0.10.8` | [![age](https://developer.mend.io/api/mc/badges/age/maven/co.touchlab.skie:configuration-annotations/0.10.8?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/co.touchlab.skie:configuration-annotations/0.10.7/0.10.8?slim=true)](https://docs.renovatebot.com/merge-confidence/) |  ---  ### Release Notes  <details> <summary>touchlab/SKIE (co.touchlab.skie)</summary>  ### [`v0.10.8`](https://redirect.github.com/touchlab/SKIE/releases/tag/0.10.8)  [Compare Source](https://redirect.github.com/touchlab/SKIE/compare/0.10.7...0.10.8)  [Change log](https://skie.touchlab.co/changelog/0.10.8)  </details>  ---  ### Configuration  📅 **Schedule**: Branch creation - Between 12

- **Issue #107** (2025-11-26): **fix(deps): update all dependencies**
  *Symptoms*: This PR contains the following updates:  | Package | Type | Update | Change | Age | Confidence | |---|---|---|---|---|---| | [gradle](https://gradle.org) ([source](https://redirect.github.com/gradle/gradle)) |  | minor | `9.1.0` -> `9.2.1` | [![age](https://developer.mend.io/api/mc/badges/age/gradle-version/gradle/9.2.1?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/gradle-version/gradle/9.1.0/9.2.1?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [gradle/actions](https://redirect.github.com/gradle/actions) | action | major | `v4` -> `v5` | [![age](https://developer.mend.io/api/mc/badges/age/github-tags/gradle%2factions/v5?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/github-tags/gradle%2factions/v4/v5?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [androidx.compose.material3:material3](https://developer.android.com/jetpack/androidx/releases/compose-material3#1.4.0) ([source](https://cs.android.com/androidx/platform/frameworks/support)) | dependencies | patch | `1.4.0-rc01` -> `1.4.0` | [![age](https://developer.mend.io/api/mc/badges/age/maven/androidx.compose.material3:material3/1.4.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/androidx.compose.material3:material3/1.4.0-rc01/1.4.0?slim=true)](ht
  **Post-Mortem & Fix Analysis**:
  > ### Edited/Blocked Notification  Renovate will not automatically rebase this PR, because it does not recognize the last commit author and assumes somebody else may have edited the PR.  You can manually request rebase by checking the rebase/retry box above.   ⚠️ **Warning**: custom changes will be lost.

- **Issue #106** (2025-09-19): **chore(deps): update gradle 9.0.0 to v9.1.0**
  *Symptoms*: Coming soon: The Renovate bot (GitHub App) will be renamed to Mend. PRs from Renovate will soon appear from 'Mend'. Learn more [here](https://redirect.github.com/renovatebot/renovate/discussions/37842).  This PR contains the following updates:  | Package | Update | Change | |---|---|---| | [gradle](https://gradle.org) ([source](https://redirect.github.com/gradle/gradle)) | minor | `9.0.0` -> `9.1.0` |  ---  ### Release Notes  <details> <summary>gradle/gradle (gradle)</summary>  ### [`v9.1.0`](https://redirect.github.com/gradle/gradle/compare/v9.0.0...v9.1.0)  [Compare Source](https://redirect.github.com/gradle/gradle/compare/v9.0.0...v9.1.0)  </details>  ---  ### Configuration  📅 **Schedule**: Branch creation - Between 12:00 AM and 03:59 AM ( * 0-3 * * * ) (UTC), Automerge - At any time (no schedule defined).  🚦 **Automerge**: Enabled.  ♻ **Rebasing**: Whenever PR is behind base branch, or you tick the rebase/retry checkbox.  🔕 **Ignore**: Close this PR and you won't be reminded about this update again.  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/android/kotlin-multiplatform-samples). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0MS45Ny4xMCIsInVwZGF0ZWRJblZlciI6IjQxLjk3LjEwIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 

- **Issue #105** (2025-09-18): **fix(deps): update all dependencies 2.9.3 to v2.9.4**
  *Symptoms*: Coming soon: The Renovate bot (GitHub App) will be renamed to Mend. PRs from Renovate will soon appear from 'Mend'. Learn more [here](https://redirect.github.com/renovatebot/renovate/discussions/37842).  This PR contains the following updates:  | Package | Change | Age | Confidence | |---|---|---|---| | [androidx.lifecycle:lifecycle-viewmodel-compose](https://developer.android.com/jetpack/androidx/releases/lifecycle#2.9.4) ([source](https://cs.android.com/androidx/platform/frameworks/support)) | `2.9.3` -> `2.9.4` | [![age](https://developer.mend.io/api/mc/badges/age/maven/androidx.lifecycle:lifecycle-viewmodel-compose/2.9.4?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/androidx.lifecycle:lifecycle-viewmodel-compose/2.9.3/2.9.4?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [androidx.lifecycle:lifecycle-viewmodel](https://developer.android.com/jetpack/androidx/releases/lifecycle#2.9.4) ([source](https://cs.android.com/androidx/platform/frameworks/support)) | `2.9.3` -> `2.9.4` | [![age](https://developer.mend.io/api/mc/badges/age/maven/androidx.lifecycle:lifecycle-viewmodel/2.9.4?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/androidx.lifecycle:lifecycle-viewmodel/2.9.3/2.9.4?slim=true)](https://docs.renovatebot.com/merge-confidence/) |  ---  ### Configuration  📅 **Schedule**: Branch cr

- **Issue #104** (2025-09-14): **fix(deps): update all dependencies 3.2.3 to v3.3.0**
  *Symptoms*: This PR contains the following updates:  | Package | Change | Age | Confidence | |---|---|---|---| | [io.ktor:ktor-serialization-kotlinx-json](https://redirect.github.com/ktorio/ktor) | `3.2.3` -> `3.3.0` | [![age](https://developer.mend.io/api/mc/badges/age/maven/io.ktor:ktor-serialization-kotlinx-json/3.3.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/io.ktor:ktor-serialization-kotlinx-json/3.2.3/3.3.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [io.ktor:ktor-client-okhttp](https://redirect.github.com/ktorio/ktor) | `3.2.3` -> `3.3.0` | [![age](https://developer.mend.io/api/mc/badges/age/maven/io.ktor:ktor-client-okhttp/3.3.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/io.ktor:ktor-client-okhttp/3.2.3/3.3.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [io.ktor:ktor-client-darwin](https://redirect.github.com/ktorio/ktor) | `3.2.3` -> `3.3.0` | [![age](https://developer.mend.io/api/mc/badges/age/maven/io.ktor:ktor-client-darwin/3.3.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/io.ktor:ktor-client-darwin/3.2.3/3.3.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [io.ktor:ktor-client-core](https://redirect.github.com/ktorio/ktor) | `3.2.3` -> `3.3.0` | [![age

- **Issue #103** (2025-11-11): **fix(deps): update kotlin dependencies**
  *Symptoms*: This PR contains the following updates:  | Package | Change | Age | Confidence | |---|---|---|---| | [co.touchlab.skie](https://skie.touchlab.co) ([source](https://redirect.github.com/touchlab/SKIE)) | `0.10.6` -> `0.10.7` | [![age](https://developer.mend.io/api/mc/badges/age/maven/co.touchlab.skie:co.touchlab.skie.gradle.plugin/0.10.7?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/co.touchlab.skie:co.touchlab.skie.gradle.plugin/0.10.6/0.10.7?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [co.touchlab.skie:configuration-annotations](https://skie.touchlab.co) ([source](https://redirect.github.com/touchlab/SKIE)) | `0.10.6` -> `0.10.7` | [![age](https://developer.mend.io/api/mc/badges/age/maven/co.touchlab.skie:configuration-annotations/0.10.7?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/co.touchlab.skie:configuration-annotations/0.10.6/0.10.7?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [com.google.devtools.ksp](https://goo.gle/ksp) ([source](https://redirect.github.com/google/ksp)) | `2.2.10-2.0.2` -> `2.3.2` | [![age](https://developer.mend.io/api/mc/badges/age/maven/com.google.devtools.ksp:com.google.devtools.ksp.gradle.plugin/2.3.2?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/c

- **Issue #102** (2025-09-11): **fix(deps): update all dependencies**
  *Symptoms*: This PR contains the following updates:  | Package | Change | Age | Confidence | |---|---|---|---| | [androidx.compose.material3:material3](https://developer.android.com/jetpack/androidx/releases/compose-material3#1.3.2) ([source](https://cs.android.com/androidx/platform/frameworks/support)) | `1.4.0-beta03` -> `1.4.0-rc01` | [![age](https://developer.mend.io/api/mc/badges/age/maven/androidx.compose.material3:material3/1.4.0-rc01?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/androidx.compose.material3:material3/1.4.0-beta03/1.4.0-rc01?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [androidx.sqlite:sqlite-bundled](https://developer.android.com/jetpack/androidx/releases/sqlite#2.6.0) ([source](https://cs.android.com/androidx/platform/frameworks/support)) | `2.5.2` -> `2.6.0` | [![age](https://developer.mend.io/api/mc/badges/age/maven/androidx.sqlite:sqlite-bundled/2.6.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/maven/androidx.sqlite:sqlite-bundled/2.5.2/2.6.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | | [androidx.compose:compose-bom](https://developer.android.com/jetpack) | `2025.08.01` -> `2025.09.00` | [![age](https://developer.mend.io/api/mc/badges/age/maven/androidx.compose:compose-bom/2025.09.00?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confide

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

### Incident Patch 1: `72b269be` (2025-11-19)
**Commit Message**: Fix api changes

**File**: `Fruitties/androidApp/src/main/java/com/example/fruitties/android/MainActivity.kt` (modified, +2/-6)
```diff
@@ -28,12 +28,10 @@ import androidx.compose.runtime.CompositionLocalProvider
 import androidx.compose.ui.Modifier
 import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
 import androidx.navigation3.runtime.NavKey
-import androidx.navigation3.runtime.entry
 import androidx.navigation3.runtime.entryProvider
 import androidx.navigation3.runtime.rememberNavBackStack
-import androidx.navigation3.runtime.rememberSavedStateNavEntryDecorator
+import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
 import androidx.navigation3.ui.NavDisplay
-import androidx.navigation3.ui.rememberSceneSetupNavEntryDecorator
 import com.example.fruitties.android.ui.CartScreen
 import com.example.fruitties.android.ui.FruittieScreen
 import com.example.fruitties.android.ui.FruittiesTheme
@@ -79,11 +77,9 @@ fun NavApp() {
     NavDisplay(
         backStack = backStack,
         entryDecorators = listOf(
-            rememberSceneSetupNavEntryDecorator(),
-            rememberSavedStateNavEntryDecorator(),
+            rememberSaveableStateHolderNavEntryDecorator(),
             rememberViewModelStoreNavEntryDecorator(),
         ),
-        onBack = { keysToRemove -> repeat(keysToRemove) { backStack.removeLastOrNull() } },
         entryProvider = entryProvider {
             entry<ListScreenKey> {
                 ListScreen(
```

---

### Incident Patch 2: `e34caf5d` (2025-11-19)
**Commit Message**: fix(deps): update all dependencies

**File**: `.github/workflows/Fruitties.yaml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ jobs:
           java-version: 17
 
       - name: Setup Gradle
-        uses: gradle/actions/setup-gradle@v4
+        uses: gradle/actions/setup-gradle@v5
         with:
           cache-encryption-key: ${{ secrets.GRADLE_ENCRYPTION_KEY }}
 
```

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +9/-9)
```diff
@@ -13,33 +13,33 @@
 # limitations under the License.
 
 [versions]
-agp = "8.13.0"
+agp = "8.13.1"
 androidx-activityCompose = "1.11.0"
 androidx-paging = "3.3.6"
-nav3Core = "1.0.0-alpha09"
+nav3Core = "1.0.0-rc01"
 lifecycleViewmodelNav3 = "1.0.0-alpha04"
 kotlinxSerializationCore = "1.9.0"
-androidx-room = "2.8.0"
+androidx-room = "2.8.3"
 androidx-lifecycle = "2.9.4"
 atomicfu = "0.29.0"
-composeBom = "2025.09.00"
+composeBom = "2025.11.00"
 dataStore = "1.1.7"
 kotlin = "2.2.21"
 kotlinx-coroutines = "1.10.2"
 kotlinxDatetime = "0.7.1-0.6.x-compat"
 ksp = "2.3.2"
-ktorVersion = "3.3.0"
+ktorVersion = "3.3.2"
 pagingComposeAndroid = "3.3.6"
 skie = "0.10.8"
-sqlite = "2.6.0"
-spotless = "7.2.1"
-okio = "3.16.0"
+sqlite = "2.6.1"
+spotless = "8.1.0"
+okio = "3.16.4"
 kermit = "2.0.8"
 runner = "1.7.0"
 core = "1.7.0"
 junit = "1.3.0"
 materialIconsCore = "1.7.8"
-material3 = "1.4.0-rc01"
+material3 = "1.4.0"
 
 [libraries]
 androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "androidx-activityCompose" }
```

**File**: `Fruitties/gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-9.1.0-bin.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-9.2.1-bin.zip
 networkTimeout=10000
 validateDistributionUrl=true
 zipStoreBase=GRADLE_USER_HOME
```

---

### Incident Patch 3: `bb606299` (2025-11-15)
**Commit Message**: fix(deps): update kotlin dependencies 0.10.7 to v0.10.8 (#108)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ kotlinxDatetime = "0.7.1-0.6.x-compat"
 ksp = "2.3.2"
 ktorVersion = "3.3.0"
 pagingComposeAndroid = "3.3.6"
-skie = "0.10.7"
+skie = "0.10.8"
 sqlite = "2.6.0"
 spotless = "7.2.1"
 okio = "3.16.0"
```

---

### Incident Patch 4: `d920ce27` (2025-11-11)
**Commit Message**: fix(deps): update kotlin dependencies (#103)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +3/-3)
```diff
@@ -24,13 +24,13 @@ androidx-lifecycle = "2.9.4"
 atomicfu = "0.29.0"
 composeBom = "2025.09.00"
 dataStore = "1.1.7"
-kotlin = "2.2.10"
+kotlin = "2.2.21"
 kotlinx-coroutines = "1.10.2"
 kotlinxDatetime = "0.7.1-0.6.x-compat"
-ksp = "2.2.10-2.0.2"
+ksp = "2.3.2"
 ktorVersion = "3.3.0"
 pagingComposeAndroid = "3.3.6"
-skie = "0.10.6"
+skie = "0.10.7"
 sqlite = "2.6.0"
 spotless = "7.2.1"
 okio = "3.16.0"
```

---

### Incident Patch 5: `00a6699b` (2025-09-18)
**Commit Message**: fix(deps): update all dependencies 2.9.3 to v2.9.4 (#105)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ nav3Core = "1.0.0-alpha09"
 lifecycleViewmodelNav3 = "1.0.0-alpha04"
 kotlinxSerializationCore = "1.9.0"
 androidx-room = "2.8.0"
-androidx-lifecycle = "2.9.3"
+androidx-lifecycle = "2.9.4"
 atomicfu = "0.29.0"
 composeBom = "2025.09.00"
 dataStore = "1.1.7"
```

---

### Incident Patch 6: `86326d46` (2025-09-14)
**Commit Message**: fix(deps): update all dependencies 3.2.3 to v3.3.0 (#104)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ kotlin = "2.2.10"
 kotlinx-coroutines = "1.10.2"
 kotlinxDatetime = "0.7.1-0.6.x-compat"
 ksp = "2.2.10-2.0.2"
-ktorVersion = "3.2.3"
+ktorVersion = "3.3.0"
 pagingComposeAndroid = "3.3.6"
 skie = "0.10.6"
 sqlite = "2.6.0"
```

---

### Incident Patch 7: `6f238cd3` (2025-09-11)
**Commit Message**: fix(deps): update all dependencies (#102)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +6/-6)
```diff
@@ -14,15 +14,15 @@
 
 [versions]
 agp = "8.13.0"
-androidx-activityCompose = "1.10.1"
+androidx-activityCompose = "1.11.0"
 androidx-paging = "3.3.6"
-nav3Core = "1.0.0-alpha08"
+nav3Core = "1.0.0-alpha09"
 lifecycleViewmodelNav3 = "1.0.0-alpha04"
 kotlinxSerializationCore = "1.9.0"
-androidx-room = "2.7.2"
+androidx-room = "2.8.0"
 androidx-lifecycle = "2.9.3"
 atomicfu = "0.29.0"
-composeBom = "2025.08.01"
+composeBom = "2025.09.00"
 dataStore = "1.1.7"
 kotlin = "2.2.10"
 kotlinx-coroutines = "1.10.2"
@@ -31,15 +31,15 @@ ksp = "2.2.10-2.0.2"
 ktorVersion = "3.2.3"
 pagingComposeAndroid = "3.3.6"
 skie = "0.10.6"
-sqlite = "2.5.2"
+sqlite = "2.6.0"
 spotless = "7.2.1"
 okio = "3.16.0"
 kermit = "2.0.8"
 runner = "1.7.0"
 core = "1.7.0"
 junit = "1.3.0"
 materialIconsCore = "1.7.8"
-material3 = "1.4.0-beta03"
+material3 = "1.4.0-rc01"
 
 [libraries]
 androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "androidx-activityCompose" }
```

---

### Incident Patch 8: `42d2da1f` (2025-08-28)
**Commit Message**: fix(deps): update all dependencies (#99)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +4/-4)
```diff
@@ -16,13 +16,13 @@
 agp = "8.12.1"
 androidx-activityCompose = "1.10.1"
 androidx-paging = "3.3.6"
-nav3Core = "1.0.0-alpha07"
+nav3Core = "1.0.0-alpha08"
 lifecycleViewmodelNav3 = "1.0.0-alpha04"
 kotlinxSerializationCore = "1.9.0"
 androidx-room = "2.7.2"
-androidx-lifecycle = "2.9.2"
+androidx-lifecycle = "2.9.3"
 atomicfu = "0.29.0"
-composeBom = "2025.08.00"
+composeBom = "2025.08.01"
 dataStore = "1.1.7"
 kotlin = "2.2.10"
 kotlinx-coroutines = "1.10.2"
@@ -39,7 +39,7 @@ runner = "1.7.0"
 core = "1.7.0"
 junit = "1.3.0"
 materialIconsCore = "1.7.8"
-material3 = "1.4.0-beta02"
+material3 = "1.4.0-beta03"
 
 [libraries]
 androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "androidx-activityCompose" }
```

---

### Incident Patch 9: `71d5e3ff` (2025-08-21)
**Commit Message**: fix(deps): update all dependencies

**File**: `.github/workflows/Fruitties.yaml` (modified, +3/-3)
```diff
@@ -31,10 +31,10 @@ jobs:
 
     steps:
       - name: Checkout
-        uses: actions/checkout@v4
+        uses: actions/checkout@v5
 
       - name: Set up JDK 17
-        uses: actions/setup-java@v4
+        uses: actions/setup-java@v5
         with:
           distribution: 'zulu'
           java-version: 17
@@ -63,7 +63,7 @@ jobs:
           xcode-version: latest-stable
     
       - name: Checkout
-        uses: actions/checkout@v4
+        uses: actions/checkout@v5
 
       - name: Build iOS app
         uses: mxcl/xcodebuild@v3
```

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +5/-5)
```diff
@@ -13,16 +13,16 @@
 # limitations under the License.
 
 [versions]
-agp = "8.11.1"
+agp = "8.12.1"
 androidx-activityCompose = "1.10.1"
 androidx-paging = "3.3.6"
-nav3Core = "1.0.0-alpha06"
+nav3Core = "1.0.0-alpha07"
 lifecycleViewmodelNav3 = "1.0.0-alpha04"
 kotlinxSerializationCore = "1.9.0"
 androidx-room = "2.7.2"
 androidx-lifecycle = "2.9.2"
 atomicfu = "0.29.0"
-composeBom = "2025.07.00"
+composeBom = "2025.08.00"
 dataStore = "1.1.7"
 kotlin = "2.2.10"
 kotlinx-coroutines = "1.10.2"
@@ -34,12 +34,12 @@ skie = "0.10.6"
 sqlite = "2.5.2"
 spotless = "7.2.1"
 okio = "3.16.0"
-kermit = "2.0.6"
+kermit = "2.0.8"
 runner = "1.7.0"
 core = "1.7.0"
 junit = "1.3.0"
 materialIconsCore = "1.7.8"
-material3 = "1.4.0-beta01"
+material3 = "1.4.0-beta02"
 
 [libraries]
 androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "androidx-activityCompose" }
```

**File**: `Fruitties/gradle/wrapper/gradle-wrapper.properties` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 distributionBase=GRADLE_USER_HOME
 distributionPath=wrapper/dists
-distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.3-bin.zip
+distributionUrl=https\://services.gradle.org/distributions/gradle-9.0.0-bin.zip
 networkTimeout=10000
 validateDistributionUrl=true
 zipStoreBase=GRADLE_USER_HOME
```

---

### Incident Patch 10: `7cb58a57` (2025-08-20)
**Commit Message**: fix(deps): update kotlin dependencies (#95)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +3/-3)
```diff
@@ -24,13 +24,13 @@ androidx-lifecycle = "2.9.2"
 atomicfu = "0.29.0"
 composeBom = "2025.07.00"
 dataStore = "1.1.7"
-kotlin = "2.2.0"
+kotlin = "2.2.10"
 kotlinx-coroutines = "1.10.2"
 kotlinxDatetime = "0.7.1-0.6.x-compat"
-ksp = "2.2.0-2.0.2"
+ksp = "2.2.10-2.0.2"
 ktorVersion = "3.2.3"
 pagingComposeAndroid = "3.3.6"
-skie = "0.10.5"
+skie = "0.10.6"
 sqlite = "2.5.2"
 spotless = "7.2.1"
 okio = "3.16.0"
```

---

### Incident Patch 11: `5de917fb` (2025-08-01)
**Commit Message**: fix(deps): update kotlin dependencies 0.10.4 to v0.10.5 (#93)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ kotlinxDatetime = "0.7.1-0.6.x-compat"
 ksp = "2.2.0-2.0.2"
 ktorVersion = "3.2.3"
 pagingComposeAndroid = "3.3.6"
-skie = "0.10.4"
+skie = "0.10.5"
 sqlite = "2.5.2"
 spotless = "7.2.1"
 okio = "3.16.0"
```

---

### Incident Patch 12: `33ec69e5` (2025-07-31)
**Commit Message**: fix(deps): update all dependencies (#92)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +6/-6)
```diff
@@ -16,8 +16,8 @@
 agp = "8.11.1"
 androidx-activityCompose = "1.10.1"
 androidx-paging = "3.3.6"
-nav3Core = "1.0.0-alpha05"
-lifecycleViewmodelNav3 = "1.0.0-alpha03"
+nav3Core = "1.0.0-alpha06"
+lifecycleViewmodelNav3 = "1.0.0-alpha04"
 kotlinxSerializationCore = "1.9.0"
 androidx-room = "2.7.2"
 androidx-lifecycle = "2.9.2"
@@ -35,11 +35,11 @@ sqlite = "2.5.2"
 spotless = "7.2.1"
 okio = "3.16.0"
 kermit = "2.0.6"
-runner = "1.6.2"
-core = "1.6.1"
-junit = "1.2.1"
+runner = "1.7.0"
+core = "1.7.0"
+junit = "1.3.0"
 materialIconsCore = "1.7.8"
-material3 = "1.4.0-alpha18"
+material3 = "1.4.0-beta01"
 
 [libraries]
 androidx-activity-compose = { module = "androidx.activity:activity-compose", version.ref = "androidx-activityCompose" }
```

---

### Incident Patch 13: `e19c2561` (2025-07-30)
**Commit Message**: fix(deps): update all dependencies (#90)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +2/-2)
```diff
@@ -28,12 +28,12 @@ kotlin = "2.2.0"
 kotlinx-coroutines = "1.10.2"
 kotlinxDatetime = "0.7.1-0.6.x-compat"
 ksp = "2.2.0-2.0.2"
-ktorVersion = "3.2.2"
+ktorVersion = "3.2.3"
 pagingComposeAndroid = "3.3.6"
 skie = "0.10.4"
 sqlite = "2.5.2"
 spotless = "7.2.1"
-okio = "3.15.0"
+okio = "3.16.0"
 kermit = "2.0.6"
 runner = "1.6.2"
 core = "1.6.1"
```

---

### Incident Patch 14: `c87c03dc` (2025-07-24)
**Commit Message**: fix(deps): update dependency org.jetbrains.kotlinx:kotlinx-datetime 0.7.1 to v0.7.1-0.6.x-compat (#85)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>

**File**: `Fruitties/gradle/libs.versions.toml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ composeBom = "2025.07.00"
 dataStore = "1.1.7"
 kotlin = "2.2.0"
 kotlinx-coroutines = "1.10.2"
-kotlinxDatetime = "0.7.1"
+kotlinxDatetime = "0.7.1-0.6.x-compat"
 ksp = "2.2.0-2.0.2"
 ktorVersion = "3.2.2"
 pagingComposeAndroid = "3.3.6"
```

---

### Incident Patch 15: `a6bf3300` (2025-07-21)
**Commit Message**: fix: Moved `enableEdgeToEdge` before `super.onCreate`

The `enableEdgeToEdge` call should be made before `super.onCreate` in `MainActivity` to ensure that the system UI and window insets are configured before the layout is inflated.
For more details refer to: https://github.com/android/compose-samples/issues/1560

**File**: `Fruitties/androidApp/src/main/java/com/example/fruitties/android/MainActivity.kt` (modified, +1/-1)
```diff
@@ -53,8 +53,8 @@ data class FruittieScreenKey(
 
 class MainActivity : ComponentActivity() {
     override fun onCreate(savedInstanceState: Bundle?) {
-        super.onCreate(savedInstanceState)
         enableEdgeToEdge()
+        super.onCreate(savedInstanceState)
         setContent {
             CompositionLocalProvider(
                 LocalAppContainer provides (this.applicationContext as FruittiesAndroidApp).container,
```

#### Recent Merged Pull Requests:
- **PR #109** (2025-11-21): chore(deps): update dependency com.google.devtools.ksp 2.3.2 to v2.3.3 (@renovate[bot])
- **PR #108** (2025-11-15): fix(deps): update kotlin dependencies 0.10.7 to v0.10.8 (@renovate[bot])
- **PR #107** (2025-11-26): fix(deps): update all dependencies (@renovate[bot])
- **PR #106** (2025-09-19): chore(deps): update gradle 9.0.0 to v9.1.0 (@renovate[bot])
- **PR #105** (2025-09-18): fix(deps): update all dependencies 2.9.3 to v2.9.4 (@renovate[bot])
- **PR #104** (2025-09-14): fix(deps): update all dependencies 3.2.3 to v3.3.0 (@renovate[bot])
- **PR #103** (2025-11-11): fix(deps): update kotlin dependencies (@renovate[bot])
- **PR #102** (2025-09-11): fix(deps): update all dependencies (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
