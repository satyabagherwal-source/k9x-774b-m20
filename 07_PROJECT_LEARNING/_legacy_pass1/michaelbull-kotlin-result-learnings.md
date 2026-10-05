# Forensic Learning Record (Deep Inspection): michaelbull/kotlin-result

> **Canonical Artifact**: `07_PROJECT_LEARNING/michaelbull-kotlin-result-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/michaelbull/kotlin-result](https://github.com/michaelbull/kotlin-result))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:20:55.983Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `michaelbull/kotlin-result`
- **Description**: A multiplatform Result monad for modelling success or failure operations.
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1258 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/src/commonMain/kotlin/com/github/michaelbull/result/BindingBenchmark.kt`
```
package com.github.michaelbull.result

import kotlinx.benchmark.Benchmark
import kotlinx.benchmark.BenchmarkMode
import kotlinx.benchmark.BenchmarkTimeUnit
import kotlinx.benchmark.Blackhole
import kotlinx.benchmark.Mode
import kotlinx.benchmark.OutputTimeUnit
import kotlinx.benchmark.Scope
import kotlinx.benchmark.State

@State(Scope.Benchmark)
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(BenchmarkTimeUnit.MILLISECONDS)
class BindingBenchmark {

    @Benchmark
    fun bindingSuccess(blackhole: Blackhole) {
        val result: Result<Int, Error> = binding {
            val x = provideX().bind()
            val y = provideY().bind()
            x + y
        }

        blackhole.consume(result)
    }

    @Benchmark
    fun bindingFailure(blackhole: Blackhole) {
        val result: Result<Int, Error> = binding {
            val x = provideX().bind()
            val z = provideZ().bind()
            x + z
        }

        blackhole.consume(result)
    }

    private object Error

    private fun provideX(): Result<Int, Error> = Ok(1)
    private fun provideY(): Result<Int, Error> = Ok(2)
    private fun provideZ(): Result<Int, Error> = Err(Error)
}

```

### Core Architecture Module: `benchmarks/src/jvmMain/kotlin/com/github/michaelbull/result/ArrowBindingBenchmark.kt`
```
package com.github.michaelbull.result

import arrow.core.Either
import arrow.core.flatMap
import arrow.core.left
import arrow.core.right
import kotlinx.benchmark.Benchmark
import kotlinx.benchmark.BenchmarkMode
import kotlinx.benchmark.BenchmarkTimeUnit
import kotlinx.benchmark.Blackhole
import kotlinx.benchmark.Mode
import kotlinx.benchmark.OutputTimeUnit
import kotlinx.benchmark.Scope
import kotlinx.benchmark.State

@State(Scope.Benchmark)
@BenchmarkMode(Mode.Throughput)
@OutputTimeUnit(BenchmarkTimeUnit.MILLISECONDS)
class ArrowBindingBenchmark {

    @Benchmark
    fun arrowFlatMapSuccess(blackhole: Blackhole) {
        val result = arrowProvideX().flatMap { x ->
            arrowProvideY().flatMap { y ->
                (x + y).right()
            }
        }

        blackhole.consume(result)
    }

    @Benchmark
    fun arrowFlatMapFailure(blackhole: Blackhole) {
        val result = arrowProvideX().flatMap { x ->
            arrowProvideZ().flatMap { z ->
                (x + z).right()
            }
        }

        blackhole.consume(result)
    }

    private object Error

    private fun arrowProvideX(): Either<Error, Int> = 1.right()
    private fun arrowProvideY(): Either<Error, Int> = 2.right()
    private fun arrowProvideZ(): Either<Error, Int> = Error.left()
}

```

### Core Architecture Module: `benchmarks/src/jvmMain/kotlin/com/github/michaelbull/result/CoroutineBindingBenchmark.kt`
```
package com.github.michaelbull.result

import arrow.core.Either
import arrow.core.raise.either
import arrow.core.right
import com.github.michaelbull.result.coroutines.coroutineBinding
import kotlinx.benchmark.Benchmark
import kotlinx.benchmark.BenchmarkMode
import kotlinx.benchmark.BenchmarkTimeUnit
import kotlinx.benchmark.Blackhole
import kotlinx.benchmark.Mode
import kotlinx.benchmark.OutputTimeUnit
import kotlinx.benchmark.Scope
import kotlinx.benchmark.State
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlin.time.Duration.Companion.milliseconds

@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(BenchmarkTimeUnit.MILLISECONDS)
class CoroutineBindingBenchmark {

    @Benchmark
    fun nonSuspendableBinding(blackhole: Blackhole) {
        blackhole.consume(nonSuspend().get())
    }

    @Benchmark
    fun suspendableBinding(blackhole: Blackhole) = runBlocking {
        blackhole.consume(withSuspend().get())
    }

    @Benchmark
    fun asyncSuspendableBinding(blackhole: Blackhole) = runBlocking {
        blackhole.consume(withAsyncSuspend().get())
    }

    @Benchmark
    fun arrowNonSuspendableBinding(blackhole: Blackhole) {
        blackhole.consume(nonSuspend().get())
    }

    @Benchmark
    fun arrowSuspendableBinding(blackhole: Blackhole) = runBlocking {
        blackhole.consume(withSuspend().get())
    }

    @Benchmark
    fun arrowAsyncSuspendableBinding(blackhole: Blackhole) = runBlocking {
        blackhole.consume(withAsyncSuspend().get())
    }

    private object Error

    private val millis = 100L

    private fun nonSuspend(): Result<Int, Error> = binding {
        val x = provideXBlocking().bind()
        val y = provideYBlocking().bind()
        x + y
    }

    private suspend fun withSuspend(): Result<Int, Error> = coroutineBinding {
        val x = provideX().bind()
        val y = provideY().bind()
        x + y
    }

    private suspend fun withAsyncSuspend(): Result<Int, Error> = coroutineBinding {
        val x = async { provideX() }
        val y = async { provideY() }
        x.await() + y.await()
    }

    private fun provideXBlocking(): Result<Int, Error> {
        Thread.sleep(millis)
        return Ok(1)
    }

    private fun provideYBlocking(): Result<Int, Error> {
        Thread.sleep(millis)
        return Ok(2)
    }

    private suspend fun provideX(): Result<Int, Error> {
        delay(millis.milliseconds)
        return Ok(1)
    }

    private suspend fun provideY(): Result<Int, Error> {
        delay(millis.milliseconds)
        return Ok(2)
    }

    private fun arrowNonSuspend(): Either<Error, Int> = either {
        val x = arrowProvideXBlocking().bind()
        val y = arrowProvideYBlocking().bind()
        x + y
    }

    private suspend fun arrowWithSuspend(): Either<Error, Int> = either {
        val x = arrowProvideX().bind()
        val y = arrowProvideY().bind()
        x + y
    }

    private suspend fun arrowWithAsyncSuspend(): Either<Error, Int> = either {
        coroutineScope {
            val x = async { arrowProvideX().bind() }
            val y = async { arrowProvideY().bind() }
            x.await() + y.await()
        }
    }

    private fun arrowProvideXBlocking(): Either<Error, Int> {
        Thread.sleep(millis)
        return 1.right()
    }

    private fun arrowProvideYBlocking(): Either<Error, Int> {
        Thread.sleep(millis)
        return 2.right()
    }

    private suspend fun arrowProvideX(): Either<Error, Int> {
        delay(millis.milliseconds)
        return 1.right()
    }

    private suspend fun arrowProvideY(): Either<Error, Int> {
        delay(millis.milliseconds)
        return 2.right()
    }
}

```

### Core Architecture Module: `example/src/main/kotlin/com/github/michaelbull/result/example/Application.kt`
```
package com.github.michaelbull.result.example

import com.fasterxml.jackson.databind.SerializationFeature
import com.github.michaelbull.result.Result
import com.github.michaelbull.result.andThen
import com.github.michaelbull.result.example.model.domain.Created
import com.github.michaelbull.result.example.model.domain.CustomerIdMustBePositive
import com.github.michaelbull.result.example.model.domain.CustomerNotFound
import com.github.michaelbull.result.example.model.domain.CustomerRequired
import com.github.michaelbull.result.example.model.domain.DatabaseError
import com.github.michaelbull.result.example.model.domain.DatabaseTimeout
import com.github.michaelbull.result.example.model.domain.DomainMessage
import com.github.michaelbull.result.example.model.domain.EmailAddressChanged
import com.github.michaelbull.result.example.model.domain.EmailInvalid
import com.github.michaelbull.result.example.model.domain.EmailRequired
import com.github.michaelbull.result.example.model.domain.EmailTooLong
import com.github.michaelbull.result.example.model.domain.Event
import com.github.michaelbull.result.example.model.domain.FirstNameChanged
import com.github.michaelbull.result.example.model.domain.FirstNameRequired
import com.github.michaelbull.result.example.model.domain.FirstNameTooLong
import com.github.michaelbull.result.example.model.domain.LastNameChanged
import com.github.michaelbull.result.example.model.domain.LastNameRequired
import com.github.michaelbull.result.example.model.domain.LastNameTooLong
import com.github.michaelbull.result.example.model.domain.SqlCustomerInvalid
import com.github.michaelbull.result.example.model.dto.CustomerDto
import com.github.michaelbull.result.example.model.entity.CustomerEntity
import com.github.michaelbull.result.example.model.entity.CustomerId
import com.github.michaelbull.result.example.repository.InMemoryCustomerRepository
import com.github.michaelbull.result.example.service.CustomerService
import com.github.michaelbull.result.mapBoth
import com.github.michaelbull.result.toResultOr
import io.ktor.http.HttpStatusCode
import io.ktor.http.Parameters
import io.ktor.serialization.jackson.jackson
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing

fun main() {
    embeddedServer(
        factory = Netty,
        port = 8080,
        host = "0.0.0.0",
        module = Application::exampleModule,
    ).start(wait = true)
}

fun Application.exampleModule() {
    configureSerialization()
    configureRouting()
}

fun Application.configureSerialization() {
    install(ContentNegotiation) {
        jackson {
            enable(SerializationFeature.INDENT_OUTPUT)
        }
    }
}

fun Application.configureRouting() {
    val customers = setOf(
        CustomerEntity(CustomerId(1L), "Michael", "Bull", "michael@example.com"),
        CustomerEntity(CustomerId(2L), "Kevin", "Herron", "kevin@example.com"),
        CustomerEntity(CustomerId(3L), "Markus", "Padourek", "markus@example.com"),
        CustomerEntity(CustomerId(4L), "Tristan", "Hamilton", "tristan@example.com"),
    )

    val customersById = customers.associateBy(CustomerEntity::id).toMutableMap()
    val customerRepository = InMemoryCustomerRepository(customersById)
    val customerService = CustomerService(customerRepository)

    routing {
        get("/customers/{id}") {
            val (status, message) = call.parameters
                .readId()
                .andThen(customerService::getById)
                .mapBoth(::customerToResponse, ::messageToResponse)

            call.respond(status, message)
        }

        post("/customers/{id}") {
            val (status, message) = call.parameters
                .readId()
                .andThen { customerService.save(it, call.receive()) }
                .mapBoth(::eventToResponse, ::messageToResponse)

            if (message != null) {
                call.respond(status, message)
            } else {
                call.respond(status)
            }
        }
    }
}

private fun Parameters.readId(): Result<Long, DomainMessage> {
    return get("id")?.toLongOrNull().toResultOr { CustomerRequired }
}

private fun customerToResponse(customer: CustomerDto) = HttpStatusCode.OK to customer

private fun messageToResponse(message: DomainMessage) = when (message) {
    CustomerRequired,
    CustomerIdMustBePositive,
    FirstNameRequired,
    FirstNameTooLong,
    LastNameRequired,
    LastNameTooLong,
    EmailRequired,
    EmailTooLong,
    EmailInvalid,
        -> HttpStatusCode.BadRequest to "There is an error in your request"

// exposed errors
    CustomerNotFound,
        -> HttpStatusCode.NotFound to "Unknown customer"

// internal errors
    SqlCustomerInvalid,
    DatabaseTimeout,
    is DatabaseError,
        -> HttpStatusCode.InternalServerError to "Internal server error occurred"
}

private fun eventToResponse(event: Event?) = when (event) {
    null ->
        HttpStatusCode.NotModified to null

    Created ->
        HttpStatusCode.Created to "Customer created"

    is FirstNameChanged ->
        HttpStatusCode.OK to "First name changed from ${event.old} to ${event.new}"

    is LastNameChanged ->
        HttpStatusCode.OK to "Last name changed from ${event.old} to ${event.new}"

    is EmailAddressChanged ->
        HttpStatusCode.OK to "Email address changed from ${event.old} to ${event.new}"
}

```

### Core Architecture Module: `example/src/main/kotlin/com/github/michaelbull/result/example/model/domain/Customer.kt`
```
package com.github.michaelbull.result.example.model.domain

data class Customer(
    val name: PersonalName,
    val email: EmailAddress,
)

```

### Core Architecture Module: `example/src/main/kotlin/com/github/michaelbull/result/example/model/domain/DomainMessage.kt`
```
package com.github.michaelbull.result.example.model.domain

/**
 * All possible things that can happen in the use-cases
 */
sealed interface DomainMessage

/* validation errors */

data object CustomerRequired : DomainMessage
data object CustomerIdMustBePositive : DomainMessage

data object FirstNameRequired : DomainMessage
data object FirstNameTooLong : DomainMessage

data object LastNameRequired : DomainMessage
data object LastNameTooLong : DomainMessage

data object EmailRequired : DomainMessage
data object EmailTooLong : DomainMessage
data object EmailInvalid : DomainMessage

/* exposed errors */

data object CustomerNotFound : DomainMessage

/* internal errors */

data object SqlCustomerInvalid : DomainMessage
data object DatabaseTimeout : DomainMessage
data class DatabaseError(val reason: String?) : DomainMessage

```

### Core Architecture Module: `example/src/main/kotlin/com/github/michaelbull/result/example/model/domain/EmailAddress.kt`
```
package com.github.michaelbull.result.example.model.domain

data class EmailAddress(
    val address: String,
)

```

### Core Architecture Module: `example/src/main/kotlin/com/github/michaelbull/result/example/model/domain/Event.kt`
```
package com.github.michaelbull.result.example.model.domain

sealed interface Event

data object Created : Event
data class FirstNameChanged(val old: String, val new: String) : Event
data class LastNameChanged(val old: String, val new: String) : Event
data class EmailAddressChanged(val old: String, val new: String) : Event

```

### Core Architecture Module: `example/src/main/kotlin/com/github/michaelbull/result/example/model/domain/PersonalName.kt`
```
package com.github.michaelbull.result.example.model.domain

data class PersonalName(
    val first: String,
    val last: String,
)

```

### Core Architecture Module: `example/src/main/kotlin/com/github/michaelbull/result/example/model/dto/CustomerDto.kt`
```
package com.github.michaelbull.result.example.model.dto

data class CustomerDto(
    val firstName: String,
    val lastName: String,
    val email: String,
)

```

### Core Architecture Module: `example/src/main/kotlin/com/github/michaelbull/result/example/model/entity/CustomerEntity.kt`
```
package com.github.michaelbull.result.example.model.entity

/**
 * Represents an [Entity](https://docs.oracle.com/cd/E17277_02/html/collections/tutorial/Entity.html)
 * mapped to a table in a database.
 */
data class CustomerEntity(
    val id: CustomerId,
    val firstName: String,
    val lastName: String,
    val email: String,
)

```

### Core Architecture Module: `example/src/main/kotlin/com/github/michaelbull/result/example/model/entity/CustomerId.kt`
```
package com.github.michaelbull.result.example.model.entity

data class CustomerId(val id: Long)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #135** (2026-03-12): **feat: unused return value checker**
  *Symptoms*: closes #134 as discussed by enabling the unused return value checker in `full` mode for the entire project and explicitly marking methods where the return value is safe to ignore with `@IgnorableReturnValue` (`onSuccess` and `onFailure`).  i've also enabled the return value checker in `check` mode in the example application to validate. here is an example warning (note that there are no warnings in the existing usage):  ![5A8wzEA_d](https://github.com/user-attachments/assets/832187d3-0b7d-4b9e-b9d7-8422648cc24f) 

- **Issue #134** (2026-03-12): **Support unused return value checker**
  *Symptoms*: kotlin 2.3.0 includes the experimental [unused return value checker](https://kotlinlang.org/docs/unused-return-value-checker.html) which surfaces warnings when a function call result is discarded. supporting it would provide additional value to library users who wish to enable it in their projects.  here are a few (non exhaustive) scenarios where this would be particularly beneficial:  - usage of methods that accept a `transform` where the result is discarded, typically to perform side effects (e.g. `map` / `mapError`). in these cases, `onSuccess` / `onFailure` would be more appropriate - discarded `bind`s within comprehension blocks where `V` != `Unit`. this is either being used for a side effect (where an explicit discard would better communicate intent) or is a bug where the user intended the value to be consumed by subsequent actions in the sequence  proposal:  - opt in across the board via full mode (as suggested in [the rfc](https://github.com/Kotlin/KEEP/blob/main/proposals/KEEP-0412-unused-return-value-checker.md#opting-in-your-library)) - specific methods where it is appropriate to ignore the return value (such as `onSuccess` / `onFailure`) can opt-out via `@IgnorableReturnValue` - users can then enable the checker in their projects if desired  a similar approach was utilized by arrow: (https://github.com/arrow-kt/arrow/pull/3773)
  **Post-Mortem & Fix Analysis**:
  > This is a great idea to explore once it's stable
  > Actually, I wonder if there's any harm in adopting it now. My understanding is that unless consumers compile with the flag enabled, it won't affect them - and from their perspective we just have a few new annotations in the codebase (indicating opt-out behaviour).
  > yeah that is my understanding as well based on the [metadata compatibility section in the rfc](https://github.com/Kotlin/KEEP/blob/main/proposals/KEEP-0412-unused-return-value-checker.md#metadata-compatibility):  > Despite the feature being experimental, Kotlin metadata for it is compatible in both ways, and using Full mode does not force the compiler to emit pre-release binaries. Compiling your library in Full mode does not cause any problems for users with the feature disabled.  if the feature for some reason is removed / does not progress past experimental, this project would just need to remove the handful of `@IgnorableReturnValue` annotations + compiler config. if you're alright with that, i can put together a pull request in the near future.

- **Issue #133** (2025-10-09): **Fix nested coroutines binding issue**
  *Symptoms*: Fix for #128 .  When running nested coroutine bindings in parallel, an exception in one will trigger a `BindCancellationException` in the other, essentially leaking the exception over. Then the exception handler code is crashing because `receiver.result` may not be ready. A diagram explaining the issue: <img width="902" height="606" alt="465261096-e415fd4f-ae7f-42cc-a62b-813f2c393ccc" src="https://github.com/user-attachments/assets/e148c4ba-2850-4b61-b7ea-a57cf4492b77" />
  **Post-Mortem & Fix Analysis**:
  > Thanks so much for the hard work on this @dbottillo. The diagram was very helpful.  I have one question: my understanding is that we're testing for single-nested bindings (i.e. one inside of the other), however do we need to test for further levels of nesting to ensure that errors are only propagated upwards by a single level, and don't follow the chain upwards automatically?  e.g.  ```kotlin val a = coroutineBinding {     val b1 = coroutineBinding {         val c = coroutineBinding {             Err("c value").bind()          }          assertEquals(c, Err("c value"))          Ok("b value")      }      assertEquals(b1, Ok("b value"))      val b2 = Err("a value").bind()      Ok(Unit) }  assertEquals(a, Err("a value")) ```
  > > Thanks so much for the hard work on this @dbottillo. The diagram was very helpful. >  > I have one question: my understanding is that we're testing for single-nested bindings (i.e. one inside of the other), however do we need to test for further levels of nesting to ensure that errors are only propagated upwards by a single level, and don't follow the chain upwards automatically? >  > e.g. >  > ```kotlin > val a = coroutineBinding { >     val b1 = coroutineBinding { >         val c = coroutineBinding { >             Err("c value").bind() >          } >  >         assertEquals(c, Err("c value")) >  >         Ok("b value") >      } >  >     assertEquals(b1, Ok("b value")) >  >     val b2 = Err("a value").bind() >  >     Ok(Unit) > } >  > assertEquals(a, Err("a value")) > ```  good shout! I've added a test to cover that scenario :) 
  > Merged in d952b52141608f653855883f1cc6274d121341a2

- **Issue #132** (2025-10-05): **Thoughts on Rich Errors?**
  *Symptoms*: I was just curious if you have any thoughts on the proposal about the [Rich Errors](https://github.com/Kotlin/KEEP/blob/main/proposals/KEEP-0441-rich-errors-motivation.md) proposal to Kotlin and how it relates to this library.  Assuming it gets added, I wonder if the library could be updated with a major version to (again) change, or remove,  the definition of the Result type and provide the great functional operations to extend the language capabilities.
  **Post-Mortem & Fix Analysis**:
  > No thoughts really.  We've [been strung along](https://github.com/michaelbull/kotlin-result?tab=readme-ov-file#2-why-not-use-kotlinresult-from-the-standard-library) historically with alternatives, whether it be the stdlib `kotlin.Result`, context receivers, context parameters, or now Rich Errors.  This library will still be maintained, but the suggestion of "removing the definition of the result type" won't happen. This will still exist to satisfy people familiar with the concept from other languages such as Rust & Elm, where it is a concrete monadic type. I'm not going to remove it as a solution for the people who prefer to write code against it as a type, especially when its existed for 8 years longer than Rich Errors and there's more production code written against it.  The "functional operations to extend the language capabilities" would likely be its own library, however I'm not really sure how many extensions you could really write against it? It'll be a bespoke language feature,
  > That makes perfect sense. I don't have any particular thoughts on this yet, was just curious to know what your thoughts around this were. I also wasn't aware that this library predated even the `Result` type from Kotlin, and I still see much more value in your approach.  I agree it probably makes more sense for my suggestion to be a new standalone library, and I'd love to help with that.   Thanks a lot for the quick response, I'll close the issue for now.
  > @caiofaustino I've added you on LinkedIn - if you come up with any ideas as we spoke about that you'd like me to pursue feel free to shoot them in a message 💪

- **Issue #130** (2025-08-04): **help needed: opt-in to unsafe access of Result.value, Result.error**
  *Symptoms*: Since kotlin-result v2.1.0, compilation of my [project](https://github.com/agrahn/Android-Password-Store) fails. I followed the instructions in the release notes on opting-in at the  project-level. I added       optIn.add("com.github.michaelbull.result.annotation.UnsafeResultValueAccess")     optIn.add("com.github.michaelbull.result.annotation.UnsafeResultErrorAccess")  to the Kotlin `compilerOptions` in `build-logic/src/main/kotlin/app/passwordstore/gradle/KotlinCommonPlugin.kt`  While my project builds locally, it still fails in the Gh pipeline:  ``` > Task :passgen:random:compileKotlin w: Opt-in requirement marker com.github.michaelbull.result.annotation.UnsafeResultValueAccess is unresolved. Please make sure it's present in the module dependencies w: Opt-in requirement marker com.github.michaelbull.result.annotation.UnsafeResultErrorAccess is unresolved. Please make sure it's present in the module dependencies e: warnings found and -Werror specified ``` (several modules affected)  How do I need to add these dependencies? Which syntax is to be used? I am using `gradle/libs.versions.toml` in the main project.  Thank you for your advice.
  **Post-Mortem & Fix Analysis**:
  > Your `build-logic` subproject doesn't have a dependency on `kotlin-result`, so it therefore cannot be the place where you adopt its annotations.  You would need to do it specifically in the subprojects that use the unsafe access with a dependency on `kotlin-result`, for example your [app's gradle file](https://github.com/agrahn/Android-Password-Store/blob/develop/app/build.gradle.kts), your [common format gradle file](https://github.com/agrahn/Android-Password-Store/blob/fc7dbeb6ed6a84010e1e05b615c044768734d981/format/common/build.gradle.kts#L9), your [crypto gradle file](https://github.com/agrahn/Android-Password-Store/blob/fc7dbeb6ed6a84010e1e05b615c044768734d981/crypto/pgpainless/build.gradle.kts#L13), and your [coroutine-utils gradle file](https://github.com/agrahn/Android-Password-Store/blob/fc7dbeb6ed6a84010e1e05b615c044768734d981/coroutine-utils/build.gradle.kts#L8).  If any of these subprojects directly access `Result.value`/`Result.error`, you'd need to opt in here. I've had a
  > Thank you for your swift reply, I appreciate your help very much. The linked project is my first Kotlin/Android related one. I am trying to keep it alive since its upstream has been archived because I want to continue using the app, so apologies for my beginner's questions.   If I remove the `optIn.add(...)` line, compilation stops at this error:      > Task :format:common:compileKotlin FAILED     e: file:///home/.../Android-Password-Store/format/common/src/main/kotlin/app/passwordstore/data/passfile/PasswordEntry.kt:67:18 Accessing `Result.value` without an explicit `Result.isOk` check is unsafe. Opt-in only when the result is guaranteed to be `Ok`.     e: file:///home/.../Android-Password-Store/format/common/src/main/kotlin/app/passwordstore/data/passfile/PasswordEntry.kt:70:19 Accessing `Result.error` without an explicit `Result.isErr` check is unsafe. Opt-in only when the result is guaranteed to be `Err`.     e: file:///home/.../Android-Password-Store/format/common/src/main/kotlin/
  > The error will always occur, you need to `OptIn` to tell the compiler that you've added the explicit check. It's not smart enough to actually check whether you have one in your code or not.  Alternatively, consider rewriting to use [`getOrThrow`](https://github.com/michaelbull/kotlin-result/blob/2.1.0/kotlin-result/src/commonMain/kotlin/com/github/michaelbull/result/Get.kt#L103)  ```kotlin import com.github.michaelbull.result.getOrThrow  val otpValue = otp.getOrThrow() emit(otpValue) delay(THOUSAND_MILLIS.milliseconds) ```

- **Issue #129** (2025-08-03): **Add arrow Either to benchmark**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Merged in 826224973ffa52dbac96507487e0a4932626fa59, thanks!  Here's the results of the JVM benchmarks from my machine:  ``` jvm summary: Benchmark                                                Mode  Cnt       Score       Error   Units BindingBenchmark.andThenFailure                         thrpt    5  244424.786 ▒  2098.383  ops/ms BindingBenchmark.andThenSuccess                         thrpt    5  356768.347 ▒  3447.893  ops/ms BindingBenchmark.arrowBindingFailure                    thrpt    5   52783.163 ▒  2193.721  ops/ms BindingBenchmark.arrowBindingSuccess                    thrpt    5  137333.224 ▒  5458.294  ops/ms BindingBenchmark.arrowFlatMapFailure                    thrpt    5  389301.978 ▒  9551.506  ops/ms BindingBenchmark.arrowFlatMapSuccess                    thrpt    5  358001.124 ▒  3348.883  ops/ms BindingBenchmark.bindingFailure                         thrpt    5  192616.641 ▒  1674.092  ops/ms BindingBenchmark.bindingSuccess                         t

- **Issue #128** (2025-10-09): **Nested coroutineBinding crash**
  *Symptoms*: 👋 I just came across a crash when dealing with nested `coroutineBinding` and would like to know what's your view on how to solve it.  The simplest way to reproduce is to take the example from the doc and wrap one of the coroutines inside a `coroutineBinding`:  ```kotlin suspend fun failsIn1ms(): Result<Int, String> {     delay(1000)     return Err("error") }  suspend fun succeedIn5ms(): Result<Int, String> {     delay(5000)     return Ok(5) } suspend fun succeedIn5msWrapper() = coroutineBinding {     succeedIn5ms().bind() }  fun main() {     runBlocking {         val res = coroutineBinding {             val x =  async { succeedIn5msWrapper().bind() }             val y = async { failsIn1ms().bind() }             x.await() + y.await()         }         res.onSuccess {             println("success: $it")         }.onFailure {             println("failure: $it")         }     } } ```  This code will crash at runtime with a NPE at this [line](https://github.com/michaelbull/kotlin-result/blob/8684b8964ca702fbe915ac11c73ecff9ed71f0c4/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/CoroutineBinding.kt#L58) inside coroutineBinding. I think what's happening is that `failsIn1ms()` is throwing a `BindCancellationException` which gets propagate to the parent which then notify its children but then `succeedIn5msWrapper()` is receiving a `BindCancellationException` which is from another coroutine and `receiver.result!!` is null at that stage.  One wa
  **Post-Mortem & Fix Analysis**:
  > I think the `receiver.result ?: throw ex` is probably the cleanest fix. Worth writing a unit test with multiple levels of nested bindings and ensuring that they propagate through as we expect. I don't think nesting bindings is something we've supported/tested for.
  > > I think the `receiver.result ?: throw ex` is probably the cleanest fix. Worth writing a unit test with multiple levels of nested bindings and ensuring that they propagate through as we expect. I don't think nesting bindings is something we've supported/tested for.  That makes sense, I'm just a bit worried now as we have already more than 200 usages and it's a bit too late to stop nesting them.
  > @dbottillo are you working on moving this issue forward with one of the proposals you outlined in your initial issue post?

- **Issue #127** (2025-08-02): **Publication via OSSRH is deprecated**
  *Symptoms*: - https://central.sonatype.org/faq/what-is-different-between-central-portal-and-legacy-ossrh/#self-service-migration - https://www.jetbrains.com/help/kotlin-multiplatform-dev/multiplatform-publish-libraries.html#set-up-the-publishing-plugin

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

### Incident Patch 1: `07ac0234` (2026-06-12)
**Commit Message**: Update best practices in LLM guidance files

**File**: `llms-full.txt` (modified, +23/-3)
```diff
@@ -688,11 +688,11 @@ These are `suspend` functions on `Flow<T>` where each operation's callback is `s
 `suspend inline fun <T, E> Flow<T>.tryFilter(crossinline predicate: suspend (T) -> Result<Boolean, E>): Result<List<T>, E>`
 `suspend inline fun <T, E> Flow<T>.tryFilterNot(crossinline predicate: suspend (T) -> Result<Boolean, E>): Result<List<T>, E>`
 `suspend inline fun <T, U, E> Flow<T>.tryFlatMap(crossinline transform: suspend (T) -> Result<Iterable<U>, E>): Result<List<U>, E>`
-`suspend inline fun <V, E> Flow<V>.tryForEach(crossinline action: suspend (V) -> Result<*, E>): Result<Unit, E>`
+`suspend inline fun <V, E> Flow<V>.tryCollect(crossinline action: suspend (V) -> Result<*, E>): Result<Unit, E>`
 `suspend inline fun <T, R, E> Flow<T>.tryFold(initial: R, crossinline operation: suspend (acc: R, T) -> Result<R, E>): Result<R, E>`
 `suspend inline fun <T, E> Flow<T>.tryReduce(crossinline operation: suspend (acc: T, T) -> Result<T, E>): Result<T, E>?`
-`suspend inline fun <T, E> Flow<T>.tryFind(crossinline predicate: suspend (T) -> Result<Boolean, E>): Result<T, E>?`
-`suspend inline fun <T, E> Flow<T>.tryFindLast(crossinline predicate: suspend (T) -> Result<Boolean, E>): Result<T, E>?`
+`suspend inline fun <T, E> Flow<T>.tryFirstOrNull(crossinline predicate: suspend (T) -> Result<Boolean, E>): Result<T, E>?`
+`suspend inline fun <T, E> Flow<T>.tryLastOrNull(crossinline predicate: suspend (T) -> Result<Boolean, E>): Result<T, E>?`
 `suspend inline fun <T, K, V, E> Flow<T>.tryAssociate(crossinline transform: suspend (T) -> Result<Pair<K, V>, E>): Result<Map<K, V>, E>`
 `suspend inline fun <T, K, E> Flow<T>.tryAssociateBy(crossinline keySelector: suspend (T) -> Result<K, E>): Result<Map<K, T>, E>`
 `suspend inline fun <T, K, V, E> Flow<T>.tryAssociateBy(crossinline keySelector: suspend (T) -> Result<K, E>, crossinline valueTransform: suspend (T) -> Result<V, E>): Result<Map<K, V>, E>`
@@ -789,6 +789,22 @@ suspend fun fetchData(url: String): Result<Data, Throwable> {
 }
 ```
 
+`runCatching` catches *every* `Throwable` and fixes the error type to `Throwable`. Reserve it for opaque boundaries whose failure modes you can't enumerate (third-party clients, platform calls). When you know the specific exception a call throws, prefer a narrow `try`/`catch` that returns a typed error — it can't accidentally swallow an unrelated bug, and it hands callers a meaningful error to `when` on instead of a bare `Throwable`:
+
+```kotlin
+sealed interface UriError {
+    data class Malformed(val input: String) : UriError
+}
+
+fun parseUri(input: String): Result<URI, UriError> {
+    return try {
+        Ok(URI(input))
+    } catch (e: URISyntaxException) {
+        Err(UriError.Malformed(input))
+    }
+}
+```
+
 ### 7. Fallible Collections
 
 Use `tryMap`, `tryFilter`, etc. when processing collections with operations that can fail.
@@ -826,6 +842,8 @@ suspend fun loadDashboard(userId: Long): Result<Dashboard, AppError> = coroutine
 8. **Prefer `getOrElse` over `unwrap`** — `unwrap` throws on Err; `getOrElse` provides a safe fallback.
 9. **Use `toResultOr` to convert nullables** — `nullableValue.toResultOr { MyError.NotFound }` is idiomatic.
 10. **Keep error types narrow** — each function should return the most specific error type it can produce.
+11. **Catch the specific exception, not `Throwable`** — when a call throws a known exception, wrap it in a narrow `try`/`catch` that returns a typed `Err`. Reserve `runCatching` (which catches every `Throwable` and yields `Throwable` as the error) for opaque boundaries whose failures you can't enumerate.
+12. **Return `Result`, not a nullable, when a failure has a reason** — a `null` says *that* something failed, never *why*. If a function can fail for several distinct reasons, model them as a sealed error and return `Result<T, E>` so callers can explain or recover per cause. (A plain lookup that's merely absent, with nothing to explain, can still return a nullable — see anti-pattern 4.)
 
 ## Anti-patterns
 
@@ -834,6 +852,8 @@ suspend fun loadDashboard(userId: Long): Result<Dashboard, AppError> = coroutine
 3. **Don't nest Results** (`Result<Result<V, E>, E>`) — use `flatMap`/`andThen` or `flatten()` instead.
 4. **Don't ignore the error type** — avoid `Result<V, Unit>` or `Result<V, Nothing>`; use `Boolean` or nullable return types if there's no meaningful error.
 5. **Don't pass `Result::isOk` as a property reference to Flow suspend predicates** — Flow's `firstOrNull` predicate is `suspend (T) -> Boolean`, which is incompatible with property references. Use a lambda instead: `{ it.isOk }`.
+6. **Don't reach for `runCatching` when you know the exception** — catching `Throwable` swallows unrelated bugs (`NullPointerException`, `OutOfMemoryError`) and discards the failure's identity. Catch the specific exception and return a typed error.
+7. **Don't collapse multiple failure causes into a `null`** — a chain of `?: return null` across distinct failure points (e.g. "no accou
```

**File**: `llms.txt` (modified, +1/-1)
```diff
@@ -38,5 +38,5 @@ Published to Maven Central as `com.michael-bull.kotlin-result`.
 - [ParZip.kt](https://github.com/michaelbull/kotlin-result/blob/master/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/ParZip.kt): `parZip` — parallel zip with cancellation, 2–5 arity
 - [flow/Flow.kt](https://github.com/michaelbull/kotlin-result/blob/master/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/flow/Flow.kt): Flow extensions — `filterOk`, `filterErr`, `allOk`, `anyOk`, `combine`, `partition`
 - [flow/Factory.kt](https://github.com/michaelbull/kotlin-result/blob/master/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/flow/Factory.kt): `Result<Flow<V>, E>.toFlow()` — bridge Result into Flow pipeline
-- [flow/Try.kt](https://github.com/michaelbull/kotlin-result/blob/master/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/flow/Try.kt): Flow `try*` operations — `tryMap`, `tryFilter`, `tryFlatMap`, `tryAssociate`, `tryGroupBy`, `tryPartition`, `tryFold`, `tryReduce`, `tryFind`, `tryForEach`
+- [flow/Try.kt](https://github.com/michaelbull/kotlin-result/blob/master/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/flow/Try.kt): Flow `try*` operations — `tryMap`, `tryFilter`, `tryFlatMap`, `tryAssociate`, `tryGroupBy`, `tryPartition`, `tryFold`, `tryReduce`, `tryCollect`, `tryFirstOrNull`, `tryLastOrNull`
 
```

---

### Incident Patch 2: `38a39157` (2026-04-11)
**Commit Message**: Fix hyperlink on transpose kdoc

**File**: `kotlin-result/src/commonMain/kotlin/com/github/michaelbull/result/Map.kt` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ public inline infix fun <V, U> Result<V, Throwable>.mapCatching(transform: (V) -
  *
  * Returns null if this [Result] is [Ok] and the [value][Result.value] is `null`, otherwise this [Result].
  *
- * - Rust: [Result.transpose][https://doc.rust-lang.org/std/result/enum.Result.html#method.transpose]
+ * - Rust: [Result.transpose](https://doc.rust-lang.org/std/result/enum.Result.html#method.transpose)
  */
 public fun <V, E> Result<V?, E>.transpose(): Result<V, E>? {
     return when {
```

---

### Incident Patch 3: `1969f9d8` (2026-04-11)
**Commit Message**: Fix ignored return value warnings by explicitly ignoring where possible

**File**: `kotlin-result-coroutines/src/commonTest/kotlin/com/github/michaelbull/result/coroutines/AsyncCoroutineBindingTest.kt` (modified, +9/-3)
```diff
@@ -142,17 +142,23 @@ class AsyncCoroutineBindingTest {
         val dispatcherC = StandardTestDispatcher(testScheduler)
 
         val result: Result<Unit, BindingError> = coroutineBinding {
-            launch(dispatcherA) { provideX().bind() }
+            launch(dispatcherA) {
+                val _ = provideX().bind()
+            }
 
             testScheduler.advanceTimeBy(20.milliseconds)
             testScheduler.runCurrent()
 
-            launch(dispatcherB) { provideY().bind() }
+            launch(dispatcherB) {
+                val _ = provideY().bind()
+            }
 
             testScheduler.advanceTimeBy(20.milliseconds)
             testScheduler.runCurrent()
 
-            launch(dispatcherC) { provideZ().bind() }
+            launch(dispatcherC) {
+                val _ = provideZ().bind()
+            }
         }
 
         assertEquals(
```

**File**: `kotlin-result/src/commonTest/kotlin/com/github/michaelbull/result/ResultIteratorTest.kt` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@ class ResultIteratorTest {
         fun returnsFalseIfYielded() {
             val iterator = Ok("hello").iterator()
 
-            iterator.next()
+            val _ = iterator.next()
 
             assertFalse(iterator.hasNext())
         }
@@ -57,7 +57,7 @@ class ResultIteratorTest {
         fun throwsExceptionIfYieldedAndOk() {
             val iterator = Ok("hello").iterator()
 
-            iterator.next()
+            val _ = iterator.next()
 
             assertFailsWith<NoSuchElementException> {
                 iterator.next()
```

---

### Incident Patch 4: `14dfbbbe` (2026-04-11)
**Commit Message**: Fix stale kdoc on transpose

**File**: `kotlin-result/src/commonMain/kotlin/com/github/michaelbull/result/Map.kt` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ public inline infix fun <V, U> Result<V, Throwable>.mapCatching(transform: (V) -
 /**
  * Transposes this [Result<V?, E>][Result] to [Result<V, E>][Result].
  *
- * Returns null if this [Result] is [Ok] and the [value][Ok.value] is `null`, otherwise this [Result].
+ * Returns null if this [Result] is [Ok] and the [value][Result.value] is `null`, otherwise this [Result].
  *
  * - Rust: [Result.transpose][https://doc.rust-lang.org/std/result/enum.Result.html#method.transpose]
  */
```

---

### Incident Patch 5: `5a77f28f` (2026-04-11)
**Commit Message**: Fix deprecated KotlinMultiplatform usage

**File**: `buildSrc/src/main/kotlin/publish-conventions.gradle.kts` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 import com.vanniktech.maven.publish.JavadocJar
 import com.vanniktech.maven.publish.KotlinMultiplatform
+import com.vanniktech.maven.publish.SourcesJar
 
 plugins {
     id("com.vanniktech.maven.publish")
@@ -12,7 +13,7 @@ mavenPublishing {
     configure(
         KotlinMultiplatform(
             javadocJar = JavadocJar.Empty(),
-            sourcesJar = true,
+            sourcesJar = SourcesJar.Sources(),
         )
     )
 
```

---

### Incident Patch 6: `ecb67a75` (2026-03-14)
**Commit Message**: Fix Flow link in README

**File**: `README.md` (modified, +1/-1)
```diff
@@ -473,7 +473,7 @@ information and licensing terms.
 [result-coroutineBinding]: https://github.com/michaelbull/kotlin-result/blob/master/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/CoroutineBinding.kt#L42
 [kotlin-coroutineScope]: https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines/coroutine-scope.html
 [result-runSuspendCatching]: https://github.com/michaelbull/kotlin-result/blob/master/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/RunSuspendCatching.kt#L16
-[result-flow]: https://github.com/michaelbull/kotlin-result/blob/master/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/Flow.kt
+[result-flow]: https://github.com/michaelbull/kotlin-result/blob/master/kotlin-result-coroutines/src/commonMain/kotlin/com/github/michaelbull/result/coroutines/flow/Flow.kt
 [kotlin-inline-classes]: https://kotlinlang.org/docs/inline-classes.html
 [wiki-Overhead]: https://github.com/michaelbull/kotlin-result/wiki/Overhead
 [stdlib-result-half-baked]: https://discuss.kotlinlang.org/t/state-of-kotlin-result-vs-kotlin-result/21103/4
```

---

### Incident Patch 7: `d052cf5c` (2026-03-09)
**Commit Message**: Rename fallible collection operations to try* prefix

mapResult -> tryMap
mapResultTo -> tryMapTo
mapResultNotNull -> tryMapNotNull
mapResultNotNullTo -> tryMapNotNullTo
mapResultIndexed -> tryMapIndexed
mapResultIndexedTo -> tryMapIndexedTo
mapResultIndexedNotNull -> tryMapIndexedNotNull
mapResultIndexedNotNullTo -> tryMapIndexedNotNullTo
fold -> tryFold
foldRight -> tryFoldRight
mapAll -> tryMap

**File**: `kotlin-result/src/commonMain/kotlin/com/github/michaelbull/result/Deprecations.kt` (modified, +81/-0)
```diff
@@ -40,3 +40,84 @@ public inline infix fun <V, E> Result<V, E>.onFailure(action: (E) -> Unit): Resu
 
     return onErr(action)
 }
+
+@Deprecated("Use tryMap instead.", ReplaceWith("tryMap(transform)"))
+public inline fun <V, E, U> Iterable<V>.mapResult(
+    transform: (V) -> Result<U, E>,
+): Result<List<U>, E> {
+    return tryMap(transform)
+}
+
+@Deprecated("Use tryMapTo instead.", ReplaceWith("tryMapTo(destination, transform)"))
+public inline fun <V, E, U, C : MutableCollection<in U>> Iterable<V>.mapResultTo(
+    destination: C,
+    transform: (V) -> Result<U, E>,
+): Result<C, E> {
+    return tryMapTo(destination, transform)
+}
+
+@Deprecated("Use tryMapNotNull instead.", ReplaceWith("tryMapNotNull(transform)"))
+public inline fun <V, E, U : Any> Iterable<V>.mapResultNotNull(
+    transform: (V) -> Result<U, E>?,
+): Result<List<U>, E> {
+    return tryMapNotNull(transform)
+}
+
+@Deprecated("Use tryMapNotNullTo instead.", ReplaceWith("tryMapNotNullTo(destination, transform)"))
+public inline fun <V, E, U : Any, C : MutableCollection<in U>> Iterable<V>.mapResultNotNullTo(
+    destination: C,
+    transform: (V) -> Result<U, E>?,
+): Result<C, E> {
+    return tryMapNotNullTo(destination, transform)
+}
+
+@Deprecated("Use tryMapIndexed instead.", ReplaceWith("tryMapIndexed(transform)"))
+public inline fun <V, E, U> Iterable<V>.mapResultIndexed(
+    transform: (index: Int, V) -> Result<U, E>,
+): Result<List<U>, E> {
+    return tryMapIndexed(transform)
+}
+
+@Deprecated("Use tryMapIndexedTo instead.", ReplaceWith("tryMapIndexedTo(destination, transform)"))
+public inline fun <V, E, U, C : MutableCollection<in U>> Iterable<V>.mapResultIndexedTo(
+    destination: C,
+    transform: (index: Int, V) -> Result<U, E>,
+): Result<C, E> {
+    return tryMapIndexedTo(destination, transform)
+}
+
+@Deprecated("Use tryMapIndexedNotNull instead.", ReplaceWith("tryMapIndexedNotNull(transform)"))
+public inline fun <V, E, U : Any> Iterable<V>.mapResultIndexedNotNull(
+    transform: (index: Int, V) -> Result<U, E>?,
+): Result<List<U>, E> {
+    return tryMapIndexedNotNull(transform)
+}
+
+@Deprecated("Use tryMapIndexedNotNullTo instead.", ReplaceWith("tryMapIndexedNotNullTo(destination, transform)"))
+public inline fun <V, E, U : Any, C : MutableCollection<in U>> Iterable<V>.mapResultIndexedNotNullTo(
+    destination: C,
+    transform: (index: Int, V) -> Result<U, E>?,
+): Result<C, E> {
+    return tryMapIndexedNotNullTo(destination, transform)
+}
+
+@Deprecated("Use tryFold instead.", ReplaceWith("tryFold(initial, operation)"))
+public inline fun <T, R, E> Iterable<T>.fold(
+    initial: R,
+    operation: (acc: R, T) -> Result<R, E>,
+): Result<R, E> {
+    return tryFold(initial, operation)
+}
+
+@Deprecated("Use tryFoldRight instead.", ReplaceWith("tryFoldRight(initial, operation)"))
+public inline fun <T, R, E> List<T>.foldRight(
+    initial: R,
+    operation: (T, acc: R) -> Result<R, E>,
+): Result<R, E> {
+    return tryFoldRight(initial, operation)
+}
+
+@Deprecated("Use tryMap instead.", ReplaceWith("tryMap(transform)"))
+public inline infix fun <V, E, U> Result<Iterable<V>, E>.mapAll(transform: (V) -> Result<U, E>): Result<List<U>, E> {
+    return tryMap(transform)
+}
```

**File**: `kotlin-result/src/commonMain/kotlin/com/github/michaelbull/result/Iterable.kt` (modified, +42/-10)
```diff
@@ -87,8 +87,12 @@ public fun <V, E, C : MutableCollection<in E>> Iterable<Result<V, E>>.filterErrT
 /**
  * Accumulates value starting with [initial] value and applying [operation] from left to right to
  * current accumulator value and each element.
+ *
+ * - Gleam: [list.try_fold](https://hexdocs.pm/gleam_stdlib/gleam/list.html#try_fold)
+ * - Haskell: [Control.Monad.foldM](https://hackage.haskell.org/package/base-4.10.0.0/docs/Control-Monad.html#v:foldM)
+ * - Rust: [Iterator::try_fold](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.try_fold)
  */
-public inline fun <T, R, E> Iterable<T>.fold(
+public inline fun <T, R, E> Iterable<T>.tryFold(
     initial: R,
     operation: (acc: R, T) -> Result<R, E>,
 ): Result<R, E> {
@@ -109,8 +113,12 @@ public inline fun <T, R, E> Iterable<T>.fold(
 /**
  * Accumulates value starting with [initial] value and applying [operation] from right to left to
  * each element and current accumulator value.
+ *
+ * - Gleam: [list.try_fold](https://hexdocs.pm/gleam_stdlib/gleam/list.html#try_fold)
+ * - Haskell: [Control.Monad.foldM](https://hackage.haskell.org/package/base-4.10.0.0/docs/Control-Monad.html#v:foldM)
+ * - Rust: [Iterator::try_fold](https://doc.rust-lang.org/std/iter/trait.Iterator.html#method.try_fold)
  */
-public inline fun <T, R, E> List<T>.foldRight(
+public inline fun <T, R, E> List<T>.tryFoldRight(
     initial: R,
     operation: (T, acc: R) -> Result<R, E>,
 ): Result<R, E> {
@@ -136,8 +144,11 @@ public inline fun <T, R, E> List<T>.foldRight(
  * Returns a [Result<List<U>, E>][Result] containing the results of applying the given [transform]
  * function to each element in the original collection, returning early with the first [Err] if a
  * transformation fails. Elements in the returned list are in the same order as [this].
+ *
+ * - Gleam: [list.try_map](https://hexdocs.pm/gleam_stdlib/gleam/list.html#try_map)
+ * - Haskell: [Data.Traversable.traverse](https://hackage.haskell.org/package/base-4.10.0.0/docs/Data-Traversable.html#v:traverse)
  */
-public inline fun <V, E, U> Iterable<V>.mapResult(
+public inline fun <V, E, U> Iterable<V>.tryMap(
     transform: (V) -> Result<U, E>,
 ): Result<List<U>, E> {
     val values = map { element ->
@@ -156,8 +167,11 @@ public inline fun <V, E, U> Iterable<V>.mapResult(
  * Applies the given [transform] function to each element of the original collection and appends
  * the results to the given [destination], returning early with the first [Err] if a
  * transformation fails. Elements in the returned list are in the same order as [this].
+ *
+ * - Gleam: [list.try_map](https://hexdocs.pm/gleam_stdlib/gleam/list.html#try_map)
+ * - Haskell: [Data.Traversable.traverse](https://hackage.haskell.org/package/base-4.10.0.0/docs/Data-Traversable.html#v:traverse)
  */
-public inline fun <V, E, U, C : MutableCollection<in U>> Iterable<V>.mapResultTo(
+public inline fun <V, E, U, C : MutableCollection<in U>> Iterable<V>.tryMapTo(
     destination: C,
     transform: (V) -> Result<U, E>,
 ): Result<C, E> {
@@ -178,8 +192,11 @@ public inline fun <V, E, U, C : MutableCollection<in U>> Iterable<V>.mapResultTo
  * given [transform] function to each element in the original collection, returning early with the
  * first [Err] if a transformation fails. Elements in the returned list are in the same order as
  * [this].
+ *
+ * - Gleam: [list.try_map](https://hexdocs.pm/gleam_stdlib/gleam/list.html#try_map)
+ * - Haskell: [Data.Traversable.traverse](https://hackage.haskell.org/package/base-4.10.0.0/docs/Data-Traversable.html#v:traverse)
  */
-public inline fun <V, E, U : Any> Iterable<V>.mapResultNotNull(
+public inline fun <V, E, U : Any> Iterable<V>.tryMapNotNull(
     transform: (V) -> Result<U, E>?,
 ): Result<List<U>, E> {
     val values = mapNotNull { element ->
@@ -199,8 +216,11 @@ public inline fun <V, E, U : Any> Iterable<V>.mapResultNotNull(
  * Applies the given [transform] function to each element in the original collection and appends
  * only the non-null results to the given [destination], returning early with the first [Err] if a
  * transformation fails.
+ *
+ * - Gleam: [list.try_map](https://hexdocs.pm/gleam_stdlib/gleam/list.html#try_map)
+ * - Haskell: [Data.Traversable.traverse](https://hackage.haskell.org/package/base-4.10.0.0/docs/Data-Traversable.html#v:traverse)
  */
-public inline fun <V, E, U : Any, C : MutableCollection<in U>> Iterable<V>.mapResultNotNullTo(
+public inline fun <V, E, U : Any, C : MutableCollection<in U>> Iterable<V>.tryMapNotNullTo(
     destination: C,
     transform: (V) -> Result<U, E>?,
 ): Result<C, E> {
@@ -222,8 +242,11 @@ public inline fun <V, E, U : Any, C : MutableCollection<in U>> Iterable<V>.mapRe
  * function to each element and its index in the original collection, returning early with the
  * first [Err] if a transformation fails. Elements in the returned list are in same order as
  * [this].
+ *
+ * - Gleam: [list.try_map](https://hexdocs.pm/gleam_stdli
```

**File**: `kotlin-result/src/commonMain/kotlin/com/github/michaelbull/result/Map.kt` (modified, +5/-2)
```diff
@@ -277,10 +277,13 @@ public inline fun <V, E, U> Result<V, E>.mapOrElse(
  * Returns a [Result<List<U>, E>][Result] containing the results of applying the given [transform]
  * function to each element in the original collection, returning early with the first [Err] if a
  * transformation fails.
+ *
+ * - Gleam: [list.try_map](https://hexdocs.pm/gleam_stdlib/gleam/list.html#try_map)
+ * - Haskell: [Data.Traversable.traverse](https://hackage.haskell.org/package/base-4.10.0.0/docs/Data-Traversable.html#v:traverse)
  */
-public inline infix fun <V, E, U> Result<Iterable<V>, E>.mapAll(transform: (V) -> Result<U, E>): Result<List<U>, E> {
+public inline infix fun <V, E, U> Result<Iterable<V>, E>.tryMap(transform: (V) -> Result<U, E>): Result<List<U>, E> {
     return andThen { iterable ->
-        iterable.mapResult(transform)
+        iterable.tryMap(transform)
     }
 }
 
```

**File**: `kotlin-result/src/commonTest/kotlin/com/github/michaelbull/result/IterableTest.kt` (modified, +278/-6)
```diff
@@ -268,11 +268,11 @@ class IterableTest {
         }
     }
 
-    class Fold {
+    class TryFold {
 
         @Test
         fun returnAccumulatedValueIfOk() {
-            val result = listOf(20, 30, 40, 50).fold(
+            val result = listOf(20, 30, 40, 50).tryFold(
                 initial = 10,
                 operation = { a, b -> Ok(a + b) },
             )
@@ -285,7 +285,7 @@ class IterableTest {
 
         @Test
         fun returnsFirstErrorIfErr() {
-            val result: Result<Int, IterableError> = listOf(5, 10, 15, 20, 25).fold(
+            val result: Result<Int, IterableError> = listOf(5, 10, 15, 20, 25).tryFold(
                 initial = 1,
                 operation = { a, b ->
                     when (b) {
@@ -303,11 +303,11 @@ class IterableTest {
         }
     }
 
-    class FoldRight {
+    class TryFoldRight {
 
         @Test
         fun returnsAccumulatedValueIfOk() {
-            val result = listOf(2, 5, 10, 20).foldRight(
+            val result = listOf(2, 5, 10, 20).tryFoldRight(
                 initial = 100,
                 operation = { a, b -> Ok(b - a) },
             )
@@ -320,7 +320,7 @@ class IterableTest {
 
         @Test
         fun returnsLastErrorIfErr() {
-            val result = listOf(2, 5, 10, 20, 40).foldRight(
+            val result = listOf(2, 5, 10, 20, 40).tryFoldRight(
                 initial = 38500,
                 operation = { a, b ->
                     when (b) {
@@ -338,6 +338,278 @@ class IterableTest {
         }
     }
 
+    class TryMap {
+
+        @Test
+        fun returnsTransformedValuesIfAllOk() {
+            val result = listOf(1, 2, 3).tryMap { Ok(it * 10) }
+
+            assertEquals(
+                expected = Ok(listOf(10, 20, 30)),
+                actual = result,
+            )
+        }
+
+        @Test
+        fun returnsFirstErrIfTransformFails() {
+            val result: Result<List<Int>, String> = listOf(1, 2, 3).tryMap { element ->
+                if (element == 2) {
+                    Err("bad")
+                } else {
+                    Ok(element * 10)
+                }
+            }
+
+            assertEquals(
+                expected = Err("bad"),
+                actual = result,
+            )
+        }
+    }
+
+    class TryMapTo {
+
+        @Test
+        fun appendsTransformedValuesIfAllOk() {
+            val destination = mutableListOf(0)
+
+            val result = listOf(1, 2, 3).tryMapTo(destination) { Ok(it * 10) }
+
+            assertEquals(
+                expected = Ok(listOf(0, 10, 20, 30)),
+                actual = result,
+            )
+        }
+
+        @Test
+        fun returnsFirstErrIfTransformFails() {
+            val destination = mutableListOf(0)
+
+            val result: Result<MutableList<Int>, String> = listOf(1, 2, 3).tryMapTo(destination) { element ->
+                if (element == 2) {
+                    Err("bad")
+                } else {
+                    Ok(element * 10)
+                }
+            }
+
+            assertEquals(
+                expected = Err("bad"),
+                actual = result,
+            )
+        }
+    }
+
+    class TryMapNotNull {
+
+        @Test
+        fun returnsNonNullTransformedValuesIfAllOk() {
+            val result = listOf(1, 2, 3).tryMapNotNull { element ->
+                if (element == 2) {
+                    null
+                } else {
+                    Ok(element * 10)
+                }
+            }
+
+            assertEquals(
+                expected = Ok(listOf(10, 30)),
+                actual = result,
+            )
+        }
+
+        @Test
+        fun returnsFirstErrIfTransformFails() {
+            val result: Result<List<Int>, String> = listOf(1, 2, 3).tryMapNotNull { element ->
+                if (element == 2) {
+                    Err("bad")
+                } else {
+                    Ok(element * 10)
+                }
+            }
+
+            assertEquals(
+                expected = Err("bad"),
+                actual = result,
+            )
+        }
+    }
+
+    class TryMapNotNullTo {
+
+        @Test
+        fun appendsNonNullTransformedValuesIfAllOk() {
+            val destination = mutableListOf(0)
+
+            val result = listOf(1, 2, 3).tryMapNotNullTo(destination) { element ->
+                if (element == 2) {
+                    null
+                } else {
+                    Ok(element * 10)
+                }
+            }
+
+            assertEquals(
+                expected = Ok(listOf(0, 10, 30)),
+                actual = result,
+            )
+        }
+
+        @Test
+        fun returnsFirstErrIfTransformFails() {
+            val destination = mutableListOf(0)
+
+            val result: Result<MutableList<Int>, String> = listOf(1, 2, 3).tryMapNotNullTo(destination) { element ->
+                if (element == 2) {
+                    Err("bad")
+                } else {
+                    O
```

**File**: `kotlin-result/src/commonTest/kotlin/com/github/michaelbull/result/MapTest.kt` (modified, +4/-4)
```diff
@@ -357,11 +357,11 @@ class MapTest {
         }
     }
 
-    class MapAll {
+    class TryMap {
 
         @Test
         fun returnsTransformedValuesIfAllOk() {
-            val result = Ok(listOf(1, 2, 3)).mapAll { Ok(it * 10) }
+            val result = Ok(listOf(1, 2, 3)).tryMap { Ok(it * 10) }
 
             assertEquals(
                 expected = Ok(listOf(10, 20, 30)),
@@ -371,7 +371,7 @@ class MapTest {
 
         @Test
         fun returnsFirstErrorIfTransformFails() {
-            val result: Result<List<Int>, String> = Ok(listOf(1, 2, 3)).mapAll { element ->
+            val result: Result<List<Int>, String> = Ok(listOf(1, 2, 3)).tryMap { element ->
                 if (element == 2) {
                     Err("bad")
                 } else {
@@ -387,7 +387,7 @@ class MapTest {
 
         @Test
         fun returnsErrorIfErr() {
-            val result = Err("error").mapAll { element: Int -> Ok(element) }
+            val result = Err("error").tryMap { element: Int -> Ok(element) }
 
             assertEquals(
                 expected = Err("error"),
```

---

### Incident Patch 8: `4ed57af9` (2026-03-04)
**Commit Message**: Fix typo in Iterable#combine

**File**: `kotlin-result/src/commonMain/kotlin/com/github/michaelbull/result/Iterable.kt` (modified, +5/-1)
```diff
@@ -145,7 +145,11 @@ public fun <V, E, R : Result<V, E>> combine(vararg results: R): Result<List<V>,
 
 /**
  * Combines [this] iterable into a single [Result] (holding a [List]). Elements in the returned
- * list are in the the same order as [this].
+ * list are in the same order as [this].
+ *
+ * - If all results [are ok][Result.isOk], returns [Ok] with all values.
+ * - If any result [is an error][Result.isErr], returns the first [Err] encountered.
+ * - If the iterable is empty, returns [Ok] with an empty list.
  *
  * - Elm: [Result.Extra.combine](http://package.elm-lang.org/packages/elm-community/result-extra/2.2.0/Result-Extra#combine)
  * - Haskell: [Data.Traversable.sequenceA](https://hackage.haskell.org/package/base-4.10.0.0/docs/Data-Traversable.html#v:sequenceA)
```

---

### Incident Patch 9: `8b7408ae` (2025-10-04)
**Commit Message**: Fix missing link on quote in README

**File**: `README.md` (modified, +6/-4)
```diff
@@ -190,10 +190,12 @@ This library was created in Oct 2017. The JetBrains team introduced `kotlin.Resu
 1.3 of the language in Oct 2018 as an experimental feature. Initially, it was limited to internal use only as it was
 "intended to be used by compiler generated code only - namely coroutines".
 
-Less than one week after stating that "we do not encourage use of kotlin.Result", the JetBrains team announced that they
-["will allow returning kotlin.Result from functions"][stdlib-result-return-type-lifted]. This came at the time when they
-were considering guiding users towards contextual receivers to replace the Result paradigm. In later years, the context
-receivers experiment was superseded by the more recent context parameters, which are still in an experimental state.
+Less than one week after stating that ["we do not encourage use of kotlin.Result"][stdlib-result-half-baked], the
+JetBrains team announced that
+they ["will allow returning kotlin.Result from functions"][stdlib-result-return-type-lifted]. This came at the time when
+they were considering guiding users towards contextual receivers to replace the Result paradigm. In later years, the
+context receivers experiment was superseded by the more recent context parameters, which are still in an experimental
+state.
 
 Michail Zarečenskij, the Lead Language Designer for Kotlin, announced at KotlinConf 2025 the development of
 ["Rich Errors in Kotlin"](https://2025.kotlinconf.com/talks/762779/), providing yet another potential solution for error
```

#### Recent Merged Pull Requests:
- **PR #135** (closed): feat: unused return value checker (@rileymichael)
- **PR #133** (closed): Fix nested coroutines binding issue (@dbottillo)
- **PR #129** (closed): Add arrow Either to benchmark (@alphaho)
- **PR #126** (closed): docs(combine): add Haskell reference to documentation for combine functions (@hoc081098)
- **PR #125** (closed): Fix Expect Actual warning (@hoangchungk53qx1)
- **PR #123** (closed): Add UnsafeResultValueAccess annotation to Result class for safer value access (@hoc081098)
- **PR #122** (closed): feat(parZip): add `parZip` functions for combining results of 2 to 5 computations in parallel (@hoc081098)
- **PR #121** (closed): Implement traverse Inspired by Haskell for Safe Transformations (@hoangchungk53qx1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
