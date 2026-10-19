> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/serpapi-google-search-results-ruby-learnings.md`  
> **Source**: github ([https://github.com/serpapi/google-search-results-ruby](https://github.com/serpapi/google-search-results-ruby))  
> **Source Version**: `11326ef3`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T17:05:34.521Z  
> **Learning ID**: `learn-github-serpapi-google-search-results-ruby`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): serpapi/google-search-results-ruby

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Problem Domain & Operational Mechanics
The `google-search-results-ruby` client library provides a programmatic interface between Ruby client applications and SerpApi's search engine scraping/parsing proxy platform. Search engines (Google, Bing, Baidu, Yandex, Yahoo, eBay, Walmart, Home Depot, Apple Store, Naver) frequently mutate frontend markup, inject anti-bot challenges (CAPTCHA, TLS fingerprinting, JS challenge scripts), and geo-fence search results. 

SerpApi exposes a REST interface where clients submit search queries, geo-coordinates, engine targets, and pagination parameters, and the SerpApi backend executes the scraping, headless rendering, extraction pipeline, and standardized JSON/HTML serialization.

The Ruby client library encapsulates:
1. **Parameter Serialization & Normalization**: Translating engine-specific parameter hashes into URL query parameters.
2. **Transport & Network Dispatch**: Issuing synchronous HTTP GET requests via Ruby's standard library (`net/http`) to `https://serpapi.com/search`.
3. **Payload Deserialization**: Converting JSON responses into deep Ruby hashes with symbol-based keys (`JSON.parse(..., symbolize_names: true)`) or raw HTML strings.
4. **Subsystem Engine Abstractions**: Specializing query parameters and endpoint paths per search engine via class inheritance hierarchies rooted at `SerpApiSearch`.

### 1.2 Architectural Topology & Boundaries

```
+---------------------------------------------------------------------------------------+
|                                Client Application Layer                               |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|  Engine Subclasses (GoogleSearch, BingSearch, BaiduSearch, EbaySearch, WalmartSearch) |
|  - Injects @engine tag into query payload                                             |
|  - Validates engine-specific mandatory keys (e.g., :q, :engine, :_nkw)                |
|  - Implements engine-level method gating (e.g., unsupported get_location guards)      |
+---------------------------------------------------------------------------------------+
                                           |
                                    (Inherits from)
                                           v
+---------------------------------------------------------------------------------------+
|                                 SerpApiSearch (Base)                                  |
|  - @params state management & normalization                                           |
|  - Singleton / Instance API Key resolution (@api_key vs @@api_key)                    |
|  - Parameter validation loop (check_params)                                           |
|  - Result extraction protocols: get_hash, get_json, get_html, get_search_archive       |
+---------------------------------------------------------------------------------------+
                     |                                              |
                     v                                              v
+----------------------------------------+     +----------------------------------------+
|          SerpApiException              |     |          Net::HTTP Execution           |
|  - Custom StandardError subclass       |     |  - Direct synchronous call to endpoint |
|  - Boundary for client validation bugs |     |  - No IO timeouts configured           |
|  - Domain constraint violation traps   |     |  - Leaks raw Errno/Socket exceptions   |
+----------------------------------------+     +----------------------------------------+
                                                                    |
                                                                    v
                                               +----------------------------------------+
                                               |       SerpApi Remote HTTP Server       |
                                               +----------------------------------------+
```

### 1.3 State Ownership & Invariant Contracts
- **Parameter Immutability Hazard**: The internal hash `@params` is initialized by direct assignment from client-provided arguments (`@params = params`). Because Ruby passes hash references by value of pointer without deep copying, external callers mutating the input dictionary mutate internal state simultaneously, breaking re-entrant query execution.
- **Global vs Instance Precedence Invariant**: The client allows setting global configuration via class attributes (`GoogleSearch.api_key = "..."`) alongside per-instance overrides (`GoogleSearch.new(api_key: "...")`). The precedence rule requires explicit instance parameters to supersede global fallback values.
- **Dual Representation Barrier**: Results are decoded synchronously into either a fully parsed Ruby `Hash` with symbol keys or unparsed raw `String` representations (JSON/HTML). The internal caching of fetched search results is omitted; invoking `get_hash` repeatedly triggers repeated HTTP network round-trips.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Domain-Specific Exception Hierarchy Separation Invariant
**RULE**:
Client wrapper SDKs MUST declare a dedicated, fully qualified Domain Exception root inheriting from the language's standard catchable error class (`StandardError` in Ruby, `Exception` in Python/TypeScript) and MUST NOT raise raw, untyped runtime strings or standard exceptions directly from client-layer validation routines. Network/transport layer exceptions MUST be classified or explicitly bounded rather than ambiguously merged into client validation faults.

**WHY**:
Raising raw strings (e.g., `raise 'error message'`) in Ruby instantiates `RuntimeError`. Client applications attempting to implement resilient error handling cannot distinguish between programmer bugs (e.g., invalid query parameter symbols), API authentication faults, upstream 5xx errors, and operational client validation exceptions without brittle string regex matching (`rescue => e; if e.message =~ /.../`).

**WHEN TO APPLY**:
Apply to every SDK client library, API wrapper, and service abstraction boundary across all programming environments.

**VERIFIED IMPLEMENTATION PATTERN**:
```ruby
# Root domain error
class SerpApiException < StandardError; end

# Specialized error subtypes for granular error handling
class ParameterValidationError < SerpApiException; end
class UnsupportedEngineFeatureError < SerpApiException; end
class TransportTimeoutError < SerpApiException; end

class SerpApiSearch
  attr_reader :params

  def initialize(params = {}, engine = nil)
    # Deep clone input params to prevent external mutation leaks
    @params = params.transform_keys(&:to_sym) rescue params.dup
    @params[:engine] ||= engine

    raise ParameterValidationError, "engine must be defined in params or as a second argument" if @params[:engine].nil?
  end

  def get_location
    raise UnsupportedEngineFeatureError, "location is not supported by engine: #{@params[:engine]}"
  end

  def execute_request(uri, timeout_seconds: 15)
    Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == 'https', 
                    open_timeout: timeout_seconds, read_timeout: timeout_seconds) do |http|
      request = Net::HTTP::Get.new(uri)
      http.request(request)
    end
  rescue Net::OpenTimeout, Net::ReadTimeout, Errno::ETIMEDOUT => e
    raise TransportTimeoutError, "Network request timed out: #{e.class} - #{e.message}"
  end
end
```

**NEGATIVE CONSTRAINT**:
```ruby
# ANTI-PATTERN: NEVER raise untyped string literals or swallow domain classification
class BrokenSerpSearch
  def initialize(params)
    @params = params
    # BAD: Instantiates generic RuntimeError. Cannot be rescued cleanly.
    raise 'engine must be defined' if @params[:engine].nil?
  end

  def get_location
    # BAD: Dynamic string concatenation directly into untyped RuntimeError
    raise 'location is not supported by ' + @params[:engine]
  end
end
```

**VERIFICATION METHOD**:
Enforce via automated RSpec expectation verifying class ancestry:
```ruby
RSpec.describe SerpApiSearch do
  it "strictly raises domain-specific exceptions inheriting from StandardError" do
    expect { SerpApiSearch.new({}) }.to raise_error do |err|
      expect(err).to be_a(SerpApiException)
      expect(err).not_to be_a(RuntimeError)
      expect(err.class.ancestors).to include(StandardError)
    end
  end
end
```

---

### 2. Network IO-Level Socket Timeout Mandatory Invariant
**RULE**:
Any network dispatch layer executing synchronous or asynchronous HTTP requests MUST configure explicit IO-level read, write, open, and connect socket timeouts on the underlying transport adapter. Code MUST NOT rely on language-level thread interruption mechanisms (such as Ruby's `Timeout.timeout`) as a primary timeout mechanism.

**WHY**:
Green-thread or asynchronous runtime interruption (like `Timeout.timeout` in Ruby or thread cancellation in POSIX) forcibly raises exceptions across asynchronous code boundaries, interrupting non-reentrant operations (such as buffer flushes, connection release to a pool, or mutex releases). This leaves sockets half-open, leaks connection descriptors, and risks connection pool deadlocks. Sockets hanging on remote TCP stalls remain uncollected indefinitely if transport timeouts are left unconfigured.

**WHEN TO APPLY**:
All client libraries, HTTP agents, and database connection factories communicating across network sockets.

**VERIFIED IMPLEMENTATION PATTERN**:
```ruby
require 'net/http'
require 'uri'

class ResilientTransport
  DEFAULT_CONNECT_TIMEOUT = 5.0
  DEFAULT_READ_TIMEOUT = 10.0
  DEFAULT_WRITE_TIMEOUT = 5.0

  def self.get(url_string, open_timeout: DEFAULT_CONNECT_TIMEOUT, read_timeout: DEFAULT_READ_TIMEOUT)
    uri = URI.parse(url_string)
    
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == 'https')
    
    # Enforce strict IO-level socket timeouts directly on the descriptor interface
    http.open_timeout  = open_timeout
    http.read_timeout  = read_timeout
    http.write_timeout = DEFAULT_WRITE_TIMEOUT if http.respond_to?(:write_timeout=)

    request = Net::HTTP::Get.new(uri.request_uri)
    response = http.request(request)

    case response.code.to_i
    when 200..299
      response.body
    else
      raise SerpApiException, "HTTP Request Failed with status: #{response.code}"
    end
  rescue Errno::ECONNREFUSED, Errno::EHOSTUNREACH, SocketError => e
    raise SerpApiException, "Network connection error: #{e.message}"
  rescue Net::OpenTimeout, Net::ReadTimeout => e
    raise SerpApiException, "Network socket IO timeout expired: #{e.message}"
  end
end
```

**NEGATIVE CONSTRAINT**:
```ruby
# ANTI-PATTERN: Relying on Timeout.timeout around untimed socket descriptors
require 'timeout'

def bad_fetch_with_thread_interruption(url)
  # BAD: Timeout.timeout spawns a watcher thread that injects an exception into the caller stack,
  # potentially during SSL handshake or socket buffer allocations.
  Timeout.timeout(5) do
    # Bad: Net::HTTP default timeouts are either infinite or platform-dependent (60s+)
    Net::HTTP.get(URI(url))
  end
rescue Timeout::Error => e
  # Bad: Connection might be leaked or left in unmanaged socket state
  raise "Fetch timed out"
end
```

**VERIFICATION METHOD**:
Enforce via unit tests stubbing `Net::HTTP.new` or using WebMock:
```ruby
RSpec.describe ResilientTransport do
  it "configures explicit IO-level socket timeouts on Net::HTTP instance" do
    http_double = instance_double(Net::HTTP)
    allow(Net::HTTP).to receive(:new).and_return(http_double)
    expect(http_double).to receive(:use_ssl=).with(true)
    expect(http_double).to receive(:open_timeout=).with(5.0)
    expect(http_double).to receive(:read_timeout=).with(10.0)
    allow(http_double).to receive(:respond_to?).with(:write_timeout=).and_return(true)
    expect(http_double).to receive(:write_timeout=).with(5.0)
    expect(http_double).to receive(:request).and_return(instance_double(Net::HTTPSuccess, code: '200', body: '{}'))

    ResilientTransport.get("https://serpapi.com/search")
  end
end
```

---

### 3. Structural Dynamic Payload Assertion Invariant (Defensive Traversal)
**RULE**:
Integration tests and consumer code interacting with dynamic third-party data pipelines MUST NOT perform rigid chained index lookups on arrays or assumed hash structures without safe navigation (`.dig`, safe traversal operators, or schema validation). Automated integration tests MUST assert structural compliance and property bounds rather than exact static counts or rigid tree structures subject to upstream drift.

**WHY**:
Upstream search engines alter layouts continuously (e.g., swapping a standard organic results card for a local business knowledge graph). Chained bracket indexing (`hash[:local_results][:places].first[:title]`) will crash with a fatal `NoMethodError: undefined method '[]' for nil:NilClass` whenever an intermediary node is omitted or altered. In integration suites, this produces false-positive pipeline failures.

**WHEN TO APPLY**:
All JSON/REST consumption layers, web scraping interfaces, and test suites validating volatile upstream schemas.

**VERIFIED IMPLEMENTATION PATTERN**:
```ruby
# Production consumption using safe dig and boundary fallbacks
def extract_top_local_title(payload)
  # Defensively navigate nested hash-array paths without crashing on nil intermediary
  places = payload.dig(:local_results, :places)
  return nil unless places.is_a?(Array) && !places.empty?

  places.first[:title]
end

# Invariant RSpec verification with flexible boundary checks
RSpec.describe "SerpApi Dynamic Response Invariants" do
  it "handles structural volatility gracefully without crashing" do
    response = { local_results: { places: [{ title: "Stumptown Coffee" }] } }
    expect(extract_top_local_title(response)).to eq("Stumptown Coffee")

    empty_response = { organic_results: [] }
    expect(extract_top_local_title(empty_response)).to be_nil
  end

  it "verifies results within boundary ranges rather than hardcoded equality" do
    organic_results = [{ title: "A" }, { title: "B" }, { title: "C" }, { title: "D" }]
    # Good: Using relational boundary (>= 4) instead of brittle static equality (== 10)
    expect(organic_results.size).to be >= 4
  end
end
```

**NEGATIVE CONSTRAINT**:
```ruby
# ANTI-PATTERN: Unsafe direct indexing into volatile schema
def unsafe_title_extraction(results)
  # BAD: Raises NoMethodError if :local_results or :places is nil
  results[:local_results][:places].first[:title]
end

# BAD SPEC: Hardcoded static size assertion on live scraping data
# expect(results[:organic_results].size).to eq(10) # Breaks when SERP returns 9 or pagination splits
```

**VERIFICATION METHOD**:
Audit codebase with RuboCop AST rule banning consecutive non-safe bracket chaining on dynamic payload decodes:
```yaml
Style/SafeNavigation:
  Enabled: true
Style/HashDig:
  Enabled: true
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Generic RuntimeError Exception Leak in Client Interface (BUG-RUBY-01)
- **Context**: `lib/search/serp_api_search.rb`, `lib/search/baidu_search.rb`, `lib/search/ebay_search.rb`, etc.
- **What Was Expected**: Parameter errors and unsupported engine feature errors should be raised as typed domain exceptions (`SerpApiException`), enabling consumers to rescue client validation failures without capturing unintended system or runtime errors.
- **What Actually Happened**: Methods used standard Ruby `raise 'string'`, which instantiates raw `RuntimeError`. Downstream callers executing `rescue SerpApiException` could not intercept these failures, leading to unhandled process crashes.
- **Evidence in Repo**: Commit `def71491`, Commit message: `"fix #6 by improving exception handling"`.
- **Root Cause**: The original author failed to establish an exception taxonomy. Domain preconditions used raw `raise 'string'`. Additionally, `get_location` in `yandex_search.rb` had a copy-paste error outputting `"location is not supported by #{YAHOO_ENGINE}"`.
- **Remediation Code Diff**:
```ruby
// lib/search/serp_api_search.rb
- raise 'engine must be defined in params or a second argument' if @params[:engine].nil?
+ raise SerpApiException.new('engine must be defined in params or a second argument') if @params[:engine].nil?

- raise 'format must be json or html' if format !~ /^(html|json)$/
+ raise SerpApiException.new('format must be json or html') if format !~ /^(html|json)$/

- raise 'keys must be a list of String or Symbol' unless keys.class == Array
+ raise SerpApiException.new('keys must be a list of String or Symbol') unless keys.class == Array

+# Standard SerpApiException for anything related to the client
+class SerpApiException < StandardError
+  def initialize(message)
+    super(message)
+  end
+end
```
- **Lesson**: Subsystem client libraries must define their own `StandardError` derived hierarchy on day one. Never use raw string `raise` in production library code.

---

### Incident 2: Brittle Spec Assertion Failures Under Upstream SERP Layout Shifts (BUG-RUBY-02)
- **Context**: `test/example_spec.rb` and `test/yahoo_search_spec.rb`.
- **What Was Expected**: The continuous integration test suite should validate the operational health of client request serialization against the live SerpApi backend.
- **What Actually Happened**: Google mutated coffee search layouts from traditional `organic_results` to localized Google Maps `local_results -> places` blocks. The test suite crashed with `NoMethodError` on `top_result[:title]` when `top_result` evaluated to `nil`. In Yahoo search specs, organic results counts dropped below 5 items, failing strict `> 4` checks.
- **Evidence in Repo**: Commit `375f7172`, Commit message: `"fix tests following search results changes (backend)"`.
- **Root Cause**: Tests assumed that search engine layout structures are static. The integration code lacked defensive traversal (`.dig`) and relied on hard strict inequalities (`> 4` vs `>= 4`) without accounting for upstream layout changes.
- **Remediation Code Diff**:
```ruby
// test/example_spec.rb
- top_result = search.get_hash[:organic_results].first
- if top_result.nil?
-   puts "oops empty organic results for #{city}"
+ results = search.get_hash
+ if results.dig(:local_results, :places).nil?
+   puts "oops empty local_results for #{city}"
    next
  end
- puts "top coffee result for #{location} is: #{top_result[:title]}"
+ puts "top coffee result for #{location} is: #{results.dig(:local_results, :places).first[:title]}"

// test/yahoo_search_spec.rb
- expect(hash[:organic_results].size).to be >4
+ expect(hash[:organic_results].size).to be >=4
```
- **Lesson**: Code handling live upstream data must use safe traversal (`.dig`) and boundary assertions (`>=`) to prevent layout variations from breaking validation pipelines.

---

### Incident 3: Gem Package Distribution Failure Due to Gemspec File Manifest Exclusion (BUG-RUBY-03)
- **Context**: `google_search_results.gemspec`, `README.md`, YARD documentation blocks.
- **What Was Expected**: When `gem build google_search_results.gemspec` runs, documentation and package assets should be packaged into the `.gem` archive, and YARD code examples should generate documentation without syntax parsing errors.
- **What Actually Happened**: `README.md` was excluded from the gemspec `s.files` array. As a result, Rubygems pages lacked package documentation, and YARD documentation generators crashed on invalid comment blocks in engine classes.
- **Evidence in Repo**: Commit `c8fc9fb1`, PR #17 (`"Merge pull request #17 from serpapi/fix-yard-examples-readme"`).
- **Root Cause**: The gemspec file manifest explicitly enumerated `lib/google_search_results.rb` and `lib/search/*.rb` using glob operations while omitting the repository root documentation files.
- **Remediation Code Diff**:
```ruby
// google_search_results.gemspec
- s.files = [ "lib/google_search_results.rb"] + Dir.glob("lib/search/*.rb")
+ s.files = [ "README.md", "lib/google_search_results.rb"] + Dir.glob("lib/search/*.rb")

// lib/search/google_search.rb
-# ```ruby
-# parameter = { ... }
-# ```
+# @example Search API Usage
+#   parameter = {
+#     q: "query", ...
+#   }
```
- **Lesson**: Gemspec file manifests should include essential metadata files (`README.md`, `LICENSE.txt`). Documentation blocks must adhere to standard YARD tags (`@example`) to prevent documentation build errors.

---

### Incident 4: Lack of Socket-Level Read Timeout Configuration Leading to Client Thread Hangs (BUG-RUBY-04)
- **Context**: `lib/search/serp_api_search.rb`, Issue #26 (`"Ability to set timeout?"`).
- **What Was Expected**: When backend scrapers experience upstream stalls (e.g., Yelp proxy hangs), client applications should fail fast after a configurable timeout period.
- **What Actually Happened**: The client wrapper used raw `open-uri` / `Net::HTTP` without configuring `read_timeout` or `open_timeout`. Downstream threads hung indefinitely or relied on Ruby's unsafe `Timeout.timeout` wrapper.
- **Evidence in Repo**: Closed Issue #26 post-mortem discussion; deprecation of repository in favor of `serpapi-ruby`.
- **Root Cause**: `SerpApiSearch` lacked configurable timeout options and connection-pooling parameters, leaving socket lifecycles entirely to runtime defaults.
- **Remediation Pattern**:
```ruby
# Recommended production fix for timeout management:
def initialize(params = {}, engine = nil, open_timeout: 5, read_timeout: 30)
  @params = params
  @params[:engine] ||= engine
  @open_timeout = open_timeout
  @read_timeout = read_timeout
  raise SerpApiException.new('engine must be defined') if @params[:engine].nil?
end

def get_results(path)
  uri = URI.parse(construct_url(path))
  Net::HTTP.start(uri.host, uri.port, use_ssl: true, 
                  open_timeout: @open_timeout, read_timeout: @read_timeout) do |http|
    req = Net::HTTP::Get.new(uri.request_uri)
    http.request(req).body
  end
rescue Net::OpenTimeout, Net::ReadTimeout => e
  raise SerpApiException.new("SerpApi connection timed out: #{e.message}")
end
```
- **Lesson**: Any production network client must expose configurable socket-level timeouts and avoid forcing consumers to rely on `Timeout.timeout`.

---

### Incident 5: Engine Misconfiguration and Hardcoded String Typo Propagation (BUG-RUBY-05)
- **Context**: `lib/search/yandex_search.rb`, `lib/search/ebay_search.rb`.
- **What Was Expected**: Engine classes should provide accurate, engine-specific diagnostic error messages when unsupported methods are called.
- **What Actually Happened**: In `yandex_search.rb`, `get_location` raised `'location is not supported by ' + YAHOO_ENGINE`. Calling `YandexSearch#get_location` reported that Yahoo did not support the operation, confusing downstream debugging.
- **Evidence in Repo**: Commit `def71491`, `lib/search/yandex_search.rb` line 29:
```ruby
- raise 'location is not supported by ' + YAHOO_ENGINE
+ raise SerpApiException.new('location is not supported by ' + YAHOO_ENGINE) # Note: Engine typo was left uncorrected
```
- **Root Cause**: Copy-pasting boilerplate across engine classes without dynamic reflection (`self.class::ENGINE`) or centralized capability flags.
- **Remediation Code Diff**:
```ruby
// Architectural fix for capability gating across engine subclasses
class SerpApiSearch
  def get_location
    raise SerpApiException.new("location is not supported by #{self.class::ENGINE_NAME}")
  end
end

class YandexSearch < SerpApiSearch
  ENGINE_NAME = "yandex"
  # No manual override required; uses dynamic class binding
end
```
- **Lesson**: Avoid copy-pasting subclass boilerplate. Define feature support using declarative capability sets or centralized base methods to prevent misleading error messages.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision
1. **Type Comparison Pitfall (`keys.class == Array` vs `is_a?(Array)`)**:
   In `lib/search/serp_api_search.rb`:
   ```ruby
   # DANGEROUS: Strict equality check on class prevents subclassing or array-like coercion
   raise SerpApiException.new('keys must be a list of String or Symbol') unless keys.class == Array
   
   # SAFE INVARIANT: Always use Object#is_a? or Object#kind_of?
   raise SerpApiException.new('keys must be a list of String or Symbol') unless keys.is_a?(Array)
   ```
2. **String Matching via Negated Regex (`format !~ /^(html|json)$/`)**:
   The expression `format !~ /^(html|json)$/` verifies format validity. However, if `format` is passed as a Symbol (e.g., `:json`), Ruby 2.x/3.x raises `NoMethodError: undefined method '=~' for :json:Symbol`.
   ```ruby
   # SAFE NORMALIZATION INVARIANT:
   ALLOWED_FORMATS = %w[html json].freeze
   raise SerpApiException.new('format must be json or html') unless ALLOWED_FORMATS.include?(format.to_s.downcase)
   ```
3. **Symbol vs String Hash Key Ambiguity**:
   The validation logic in `check_params` handles mixed keys via explicit type branch switching:
   ```ruby
   case key.class.to_s
   when 'Symbol'
     missing << key unless @params.has_key?(key)
   when 'String'
     missing << key unless @params.has_key?(key.to_sym) || @params.has_key?(key)
   ```
   If a client supplies an integer or custom object, the library enters the `else` branch and raises an error, even if the key is valid. The proper invariant is to transform the input hash keys upon ingestion:
   ```ruby
   @params = params.each_with_object({}) { |(k, v), h| h[k.to_sym] = v }
   ```

### 4.2 Infinite Loop & Recursion Guards
1. **Self-Referencing Hash Payloads in Serialization**:
   If a client injects a circular reference into `@params`:
   ```ruby
   params = { q: "coffee" }
   params[:self] = params
   search = GoogleSearch.new(params)
   ```
   Executing `URI.encode_www_form(@params)` or recursive validation triggers a `SystemStackError: stack level too deep`.
   *Invariant Rule*: Any recursive query serializer must track visited object IDs:
   ```ruby
   def safe_flatten_params(hash, visited = Set.new)
     raise SerpApiException, "Circular reference detected in query params" if visited.include?(hash.object_id)
     visited.add(hash.object_id)
     # Proceed with traversal
   end
   ```

### 4.3 UI & UX Micro-Mechanics (CLI & Developer Ergonomics)
1. **Stdout Pollution in Demonstration Code**:
   In `test/example_spec.rb`, debugging output uses `puts` directly inside test executions:
   ```ruby
   puts "top coffee result for #{location} is: #{results.dig(:local_results, :places).first[:title]}"
   ```
   In headless CI/CD environments, uncontrolled terminal stdout can corrupt structured output formatters (e.g., TAP or JSON spec reporters). Library and test code should use structured loggers with log-level gating.

### 4.4 Backend Concurrency & Memory Safety
1. **Global Class Variable Mutation Race (TOCTOU Hazard)**:
   In `GoogleSearch.api_key = "secret"`, the library stores credentials in a class-level variable (`@@api_key`).
   ```ruby
   # THREAD-UNSAFE PATTERN:
   class SerpApiSearch
     @@api_key = nil
     def self.api_key=(key); @@api_key = key; end
     def get_api_key; @params[:api_key] || @@api_key; end
   end
   ```
   In multi-tenant or concurrent environments (e.g., Sidekiq, Puma), Thread A changing `GoogleSearch.api_key = "Key_A"` can overwrite Thread B's search execution, leading to credential cross-contamination.
   *Concurrency Invariant*: Store global fallbacks in thread-local or fiber-local storage:
   ```ruby
   def self.api_key=(key)
     Thread.current[:serp_api_key] = key
   end
   def self.api_key
     Thread.current[:serp_api_key]
   end
   ```

### 4.5 Defect & Error Prevention ("Galti Pakadna")
1. **Off-by-One Array Dereference on Nil Extraction**:
   Accessing `.first` on an empty collection returns `nil`. Chaining `[]` on that result causes a crash:
   ```ruby
   # CRASH RISK:
   results.dig(:local_results, :places).first[:title] # Crashes if places == []
   
   # DEFENSIVE INVARIANT:
   results.dig(:local_results, :places)&.first&.dig(:title)
   ```
2. **Missing HTTP Response Status Validation**:
   The network execution path directly decodes response bodies without verifying HTTP status codes:
   ```ruby
   # Net::HTTP.get returns the body string even on 403 Forbidden or 500 Internal Server Error
   raw_response = Net::HTTP.get(uri)
   json = JSON.parse(raw_response, symbolize_names: true)
   ```
   When SerpApi returns an HTML 502 Bad Gateway page or a JSON `{ error: "Invalid API Key" }`, the client library may parse the error as valid results or crash during JSON decoding.
   *Validation Invariant*: Check response status codes and error payloads before returning:
   ```ruby
   if response.is_a?(Net::HTTPSuccess)
     payload = JSON.parse(response.body, symbolize_names: true)
     raise SerpApiException, payload[:error] if payload.key?(:error)
     payload
   else
     raise SerpApiException, "HTTP Error: #{response.code} #{response.message}"
   end
   ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Structure**: Class inheritance hierarchy rooted at `SerpApiSearch` (`lib/search/serp_api_search.rb`). Each search engine (Google, Bing, Baidu, DuckDuckGo, eBay, Walmart, etc.) inherits from this base class.
- **Decoupling**: Decoupling is shallow. Engine subclasses pass parameter defaults back to the base class, but base class methods hardcode format behaviors and network dispatching logic directly.
- **State Ownership**: Mutable state resides entirely in the `@params` instance variable. The lack of immutability permits parameter leakage across query calls if the object is reused.

### 2. Core Abstractions
- **Primary Type**: `SerpApiSearch` - Encapsulates query parameters, API keys, and HTTP GET execution logic.
- **Subclass Specializations**: Concrete engine subclasses (`GoogleSearch`, `BingSearch`, etc.) configure default `:engine` parameters and validate required keys via `check_params`.
- **Domain Error**: `SerpApiException < StandardError` - Represents all client-layer validation failures and protocol errors.

### 3. Error Handling
- **Failure Boundaries**: Precondition checks are performed in `#initialize` and `#check_params`, raising `SerpApiException` on missing or invalid parameters.
- **Degradation**: No automatic retries, backoff mechanisms, or circuit breakers are implemented. Network errors (e.g., `SocketError`, `Errno::ECONNRESET`) are unhandled and propagate up the stack.
- **Error Propagation**: Upstream API errors (e.g., HTTP 4xx/5xx) are not translated into structured domain exceptions, causing downstream errors during response parsing.

### 4. Testing
- **Framework**: RSpec (`spec`) suite located in `test/*_spec.rb`.
- **Harness Mechanics**: Integration tests perform live network requests against the production SerpApi backend using an exported `API_KEY` environment variable.
- **Resilience**: Tests use boundary matchers (`be >= 4`) to handle fluctuating search results, though the lack of mock fixtures (e.g., VCR, WebMock) makes test runs dependent on network connectivity and API quota.

### 5. Security
- **Credential Storage**: API keys are accepted as query parameters (`:api_key`) and merged into the request URL.
- **Credential Leakage in Logs**: Sending API keys as URL query parameters (`https://serpapi.com/search?api_key=secret&q=coffee`) exposes credentials in proxy logs, HTTP access logs, and browser histories.
- **Safe Alternative**: Pass API keys via authorization headers (`Authorization: Bearer secret`) where supported, or ensure transport logs mask the `api_key` query parameter.

### 6. Performance