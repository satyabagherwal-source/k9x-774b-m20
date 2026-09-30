# Forensic Learning Record (Deep Inspection): Kuddev/pebrel

> **Canonical Artifact**: `07_PROJECT_LEARNING/kuddev-pebrel-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Kuddev/pebrel](https://github.com/Kuddev/pebrel))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:14:43.819Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Kuddev/pebrel`
- **Description**: AI-native, GPU-accelerated terminal emulator for Windows with SSH, persistent sessions, split panes, and first-class AI CLI workflows.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 2651 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mobile/android/app/src/main/assets/reader/extensions.js`
```
(function () {
  var generation = 0;
  var labels = { error: '', loading: '' };
  var diagrams = new Map();
  var cacheBytes = 0;
  var nextDiagram = 0;
  var queue = Promise.resolve();

  window.pebrelSetReaderLabels = function (error, loading) {
    labels = { error: error, loading: loading };
    document.querySelectorAll('[data-render-error]').forEach(function (node) { node.textContent = error; });
    document.querySelectorAll('[data-render-loading]').forEach(function (node) { node.textContent = loading; });
  };

  function renderMath() {
    document.querySelectorAll('.math-render:not([data-rendered])').forEach(function (node) {
      node.dataset.rendered = 'true';
      var source = node.textContent;
      try {
        if (source.length > 32768) throw new Error('formula_size');
        katex.render(source, node, { displayMode: node.dataset.display === 'true', throwOnError: true,
          trust: false, strict: 'warn', maxExpand: 1000, maxSize: 20, output: 'htmlAndMathml' });
      } catch (_) {
        node.textContent = source;
        node.classList.add('render-error');
      }
    });
  }

  function renderDiagram(node, current) {
    if (current !== generation || !node.isConnected) return Promise.resolve();
    var figure = node.closest('.diagram');
    var source = figure.querySelector('code').textContent;
    var key = figure.id + ':' + source;
    var cached = diagrams.get(key);
    if (cached) { delete node.dataset.renderError; node.innerHTML = cached; return Promise.resolve(); }
    delete node.dataset.renderError;
    node.dataset.renderLoading = 'true';
    node.textContent = labels.loading;
    return new Promise(function (resolve) { setTimeout(resolve, 0); }).then(function () {
      if (current !== generation || !node.isConnected) return null;
      if (source.length > 50000) throw new Error('diagram_size');
      return mermaid.render('pebrel-diagram-' + (++nextDiagram), source);
    }).then(function (result) {
      if (!result || current !== generation || !node.isConnected) return;
      delete node.dataset.renderLoading;
      // strict 模式清洗 SVG；不绑定图中的脚本或外链回调。
      node.innerHTML = result.svg;
      node.querySelectorAll('a').forEach(function (link) { link.removeAttribute('href'); link.removeAttribute('xlink:href'); });
      var svg = node.innerHTML;
      if (svg.length <= 512000) {
        diagrams.set(key, svg); cacheBytes += key.length + svg.length;
        while (diagrams.size > 24 || cacheBytes > 2 * 1024 * 1024) {
          var first = diagrams.keys().next().value;
          cacheBytes -= first.length + diagrams.get(first).length;
          diagrams.delete(first);
        }
      }
    }).catch(function () {
      if (current !== generation || !node.isConnected) return;
      delete node.dataset.renderLoading;
      node.dataset.renderError = 'true';
      node.textContent = labels.error;
      figure.querySelector('details').open = true;
    });
  }

  window.pebrelEnhance = function () {
    var current = ++generation;
    renderMath();
    var style = getComputedStyle(document.documentElement);
    if (window.mermaid) mermaid.initialize({ startOnLoad: false, securityLevel: 'strict',
      suppressErrorRendering: true, maxTextSize: 50000, maxEdges: 500,
      secure: ['securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'suppressErrorRendering'],
      theme: 'base', htmlLabels: false, flowchart: { htmlLabels: false },
      themeVariables: { background: style.getPropertyValue('--background').trim(),
        primaryColor: style.getPropertyValue('--surface').trim(),
        primaryTextColor: style.getPropertyValue('--foreground').trim(),
        primaryBorderColor: style.getPropertyValue('--border').trim(),
        lineColor: style.getPropertyValue('--muted').trim(),
        secondaryColor: style.getPropertyValue('--surface').trim(),
        tertiaryColor: style.getPropertyValue('--background').trim(), fontFamily: 'sans-serif' } });
    var nodes = Array.from(document.querySelectorAll('[data-diagram]'));
    // Mermaid 内部有全局布局状态，串行渲染；换页后不让旧 Promise 改写新文档。
    queue = queue.catch(function () {}).then(function () {
      return nodes.reduce(function (previous, node) {
        return previous.then(function () { return renderDiagram(node, current); });
      }, Promise.resolve());
    });
    return queue;
  };
})();

```

### Core Architecture Module: `mobile/android/app/src/main/assets/reader/reader-compat.js`
```
(()=>{var iv=Object.create;var La=Object.defineProperty;var nv=Object.getOwnPropertyDescriptor;var ov=Object.getOwnPropertyNames;var uv=Object.getPrototypeOf,sv=Object.prototype.hasOwnProperty;var i=(r,e)=>()=>{try{return e||r((e={exports:{}}).exports,e),e.exports}catch(t){throw e=0,t}};var cv=(r,e,t,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let o of ov(e))!sv.call(r,o)&&o!==t&&La(r,o,{get:()=>e[o],enumerable:!(a=nv(e,o))||a.enumerable});return r};var Mr=(r,e,t)=>(t=r!=null?iv(uv(r)):{},cv(e||!r||!r.__esModule?La(t,"default",{value:r,enumerable:!0}):t,r));var O=i((De,Ua)=>{"use strict";var ir=function(r){return r&&r.Math===Math&&r};Ua.exports=ir(typeof globalThis=="object"&&globalThis)||ir(typeof window=="object"&&window)||ir(typeof self=="object"&&self)||ir(typeof global=="object"&&global)||ir(typeof De=="object"&&De)||(function(){return this})()||Function("return this")()});var g=i((rE,Ga)=>{"use strict";Ga.exports=function(r){try{return!!r()}catch{return!0}}});var w=i((eE,$a)=>{"use strict";var vv=g();$a.exports=!vv(function(){return Object.defineProperty({},1,{get:function(){return 7}})[1]!==7})});var Fr=i((tE,Ka)=>{"use strict";var fv=g();Ka.exports=!fv(function(){var r=function(){}.bind();return typeof r!="function"||r.hasOwnProperty("prototype")})});var B=i((aE,Va)=>{"use strict";var lv=Fr(),Br=Function.prototype.call;Va.exports=lv?Br.bind(Br):function(){return Br.apply(Br,arguments)}});var Ya=i(Ha=>{"use strict";var Wa={}.propertyIsEnumerable,za=Object.getOwnPropertyDescriptor,pv=za&&!Wa.call({1:2},1);Ha.f=pv?function(e){var t=za(this,e);return!!t&&t.enumerable}:Wa});var K=i((nE,Xa)=>{"use strict";Xa.exports=function(r,e){return{enumerable:!(r&1),configurable:!(r&2),writable:!(r&4),value:e}}});var h=i((oE,Za)=>{"use strict";var Qa=Fr(),Ja=Function.prototype,Ne=Ja.call,yv=Qa&&Ja.bind.bind(Ne,Ne);Za.exports=Qa?yv:function(r){return function(){return Ne.apply(r,arguments)}}});var V=i((uE,ei)=>{"use strict";var ri=h(),qv=ri({}.toString),dv=ri("".slice);ei.exports=function(r){return dv(qv(r),8,-1)}});var ai=i((sE,ti)=>{"use strict";var gv=h(),hv=g(),Ev=V(),je=Object,Ov=gv("".split);ti.exports=hv(function(){return!je("z").propertyIsEnumerable(0)})?function(r){return Ev(r)==="String"?Ov(r,""):je(r)}:je});var H=i((cE,ii)=>{"use strict";ii.exports=function(r){return r==null}});var nr=i((vE,ni)=>{"use strict";var bv=H(),Sv=TypeError;ni.exports=function(r){if(bv(r))throw new Sv("Can't call method on "+r);return r}});var Y=i((fE,oi)=>{"use strict";var Tv=ai(),Rv=nr();oi.exports=function(r){return Tv(Rv(r))}});var b=i((lE,ui)=>{"use strict";var Me=typeof document=="object"&&document.all;ui.exports=typeof Me>"u"&&Me!==void 0?function(r){return typeof r=="function"||r===Me}:function(r){return typeof r=="function"}});var P=i((pE,si)=>{"use strict";var Iv=b();si.exports=function(r){return typeof r=="object"?r!==null:Iv(r)}});var k=i((yE,ci)=>{"use strict";var Fe=O(),wv=b(),xv=function(r){return wv(r)?r:void 0};ci.exports=function(r,e){return arguments.length<2?xv(Fe[r]):Fe[r]&&Fe[r][e]}});var or=i((qE,vi)=>{"use strict";var mv=h();vi.exports=mv({}.isPrototypeOf)});var Be=i((dE,pi)=>{"use strict";var Pv=O(),fi=Pv.navigator,li=fi&&fi.userAgent;pi.exports=li?String(li):""});var Le=i((gE,Ei)=>{"use strict";var hi=O(),ke=Be(),yi=hi.process,qi=hi.Deno,di=yi&&yi.versions||qi&&qi.version,gi=di&&di.v8,N,kr;gi&&(N=gi.split("."),kr=N[0]>0&&N[0]<4?1:+(N[0]+N[1]));!kr&&ke&&(N=ke.match(/Edge\/(\d+)/),(!N||N[1]>=74)&&(N=ke.match(/Chrome\/(\d+)/),N&&(kr=+N[1])));Ei.exports=kr});var Ue=i((hE,bi)=>{"use strict";var Oi=Le(),_v=g(),Av=O(),Cv=Av.String;bi.exports=!!Object.getOwnPropertySymbols&&!_v(function(){var r=Symbol("symbol detection");return!Cv(r)||!(Object(r)instanceof Symbol)||!Symbol.sham&&Oi&&Oi<41})});var Ge=i((EE,Si)=>{"use strict";var Dv=Ue();Si.exports=Dv&&!Symbol.sham&&typeof Symbol.iterator=="symbol"});var Lr=i((OE,Ti)=>{"use strict";var Nv=k(),jv=b(),Mv=or(),Fv=Ge(),Bv=Object;Ti.exports=Fv?function(r){return typeof r=="symbol"}:function(r){var e=Nv("Symbol");return jv(e)&&Mv(e.prototype,Bv(r))}});var Ur=i((bE,Ri)=>{"use strict";var kv=String;Ri.exports=function(r){try{return kv(r)}catch{return"Object"}}});var Gr=i((SE,Ii)=>{"use strict";var Lv=b(),Uv=Ur(),Gv=TypeError;Ii.exports=function(r){if(Lv(r))return r;throw new Gv(Uv(r)+" is not a function")}});var $r=i((TE,wi)=>{"use strict";var $v=Gr(),Kv=H();wi.exports=function(r,e){var t=r[e];return Kv(t)?void 0:$v(t)}});var mi=i((RE,xi)=>{"use strict";var $e=B(),Ke=b(),Ve=P(),Vv=TypeError;xi.exports=function(r,e){var t,a;if(e==="string"&&Ke(t=r.toString)&&!Ve(a=$e(t,r))||Ke(t=r.valueOf)&&!Ve(a=$e(t,r))||e!=="string"&&Ke(t=r.toString)&&!Ve(a=$e(t,r)))return a;throw new Vv("Can't convert object to primitive value")}});var W=i((IE,Pi)=>{"use strict";Pi.exports=!1});var Kr=i((wE,Ai)=>{"use strict";var _i=O(),Wv=Object.defineProperty;Ai.exports=function(r,e){try{Wv(_i,r,{value:e,configurable:!0,writable:!0})}catch{_i[r]=e}return e}});var Vr=i((xE,Ni)=>{"use strict";var zv=W(),Hv=O(),Yv=Kr(),Ci="__core-js_shared__",Di=Ni.exports=Hv[Ci]||Yv(Ci,{});(Di.versions||(Di.versions=[])).push({version:"3.50.0",mode:zv?"pure":"global",copyright:"© 2013–2025 Denis Pushkarev (zloirock.ru), 2025–2026 CoreJS Company (core-js.io). All rights reserved.",license:"https://github.com/zloirock/core-js/blob/v3.50.0/LICENSE",source:"https://github.com/zloirock/core-js"})});var We=i((mE,Mi)=>{"use strict";var ji=Vr(),Xv=Object.create||Object;Mi.exports=function(r,e){return ji[r]||(ji[r]=e||Xv(null))}});var ur=i((PE,Fi)=>{"use strict";var Qv=nr(),Jv=Object;Fi.exports=function(r){return Jv(Qv(r))}});var x=i((_E,Bi)=>{"use strict";var Zv=h(),rf=ur(),ef=Zv({}.hasOwnProperty);Bi.exports=Object.hasOwn||function(e,t){return ef(rf(e),t)}});var sr=i((AE,ki)=>{"use strict";var tf=h(),af=0,nf=Math.random(),of=tf(1.1.toString);ki.exports=function(r){return"Symbol("+(r===void 0?"":r)+")_"+of(++af+nf,36)}});var C=i((CE,Ui)=>{"use strict";var uf=O(),sf=We(),Li=x(),cf=sr(),vf=Ue(),ff=Ge(),Z=uf.Symbol,ze=sf("wks"),lf=ff?Z.for||Z:Z&&Z.withoutSetter||cf;Ui.exports=function(r){return Li(ze,r)||(ze[r]=vf&&Li(Z,r)?Z[r]:lf("Symbol."+r)),ze[r]}});var Vi=i((DE,Ki)=>{"use strict";var pf=B(),Gi=P(),$i=Lr(),yf=$r(),qf=mi(),df=C(),gf=TypeError,hf=df("toPrimitive");Ki.exports=function(r,e){if(!Gi(r)||$i(r))return r;var t=yf(r,hf),a;if(t){if(e===void 0&&(e="default"),a=pf(t,r,e),!Gi(a)||$i(a))return a;throw new gf("Can't convert object to primitive value")}return e===void 0&&(e="number"),qf(r,e)}});var He=i((NE,Wi)=>{"use strict";var Ef=Vi(),Of=Lr();Wi.exports=function(r){var e=Ef(r,"string");return Of(e)?e:e+""}});var Xe=i((jE,Hi)=>{"use strict";var bf=O(),zi=P(),Ye=bf.document,Sf=zi(Ye)&&zi(Ye.createElement);Hi.exports=function(r){return Sf?Ye.createElement(r):{}}});var Qe=i((ME,Yi)=>{"use strict";var Tf=w(),Rf=g(),If=Xe();Yi.exports=!Tf&&!Rf(function(){return Object.defineProperty(If("div"),"a",{get:function(){return 7}}).a!==7})});var Je=i(Qi=>{"use strict";var wf=w(),xf=B(),mf=Ya(),Pf=K(),_f=Y(),Af=He(),Cf=x(),Df=Qe(),Xi=Object.getOwnPropertyDescriptor;Qi.f=wf?Xi:function(e,t){if(e=_f(e),t=Af(t),Df)try{return Xi(e,t)}catch{}if(Cf(e,t))return Pf(!xf(mf.f,e,t),e[t])}});var Ze=i((BE,Ji)=>{"use strict";var Nf=w(),jf=g();Ji.exports=Nf&&jf(function(){return Object.defineProperty(function(){},"prototype",{value:42,writable:!1}).prototype!==42})});var D=i((kE,Zi)=>{"use strict";var Mf=P(),Ff=String,Bf=TypeError;Zi.exports=function(r){if(Mf(r))return r;throw new Bf(Ff(r)+" is not an object")}});var A=i(en=>{"use strict";var kf=w(),Lf=Qe(),Uf=Ze(),Wr=D(),rn=He(),Gf=TypeError,rt=Object.defineProperty,$f=Object.getOwnPropertyDescriptor,et="enumerable",tt="configurable",at="writable";en.f=kf?Uf?function(e,t,a){if(Wr(e),t=rn(t),Wr(a),typeof e=="function"&&t==="prototype"&&"value"in a&&at in a&&!a[at]){var o=$f(e,t);o&&o[at]&&(e[t]=a.value,a={configurable:tt in a?a[tt]:o[tt],enumerable:et in a?a[et]:o[et],writable:!1})}return rt(e,t,a)}:rt:function(e,t,a){if(Wr(e),t=rn(t
```

### Core Architecture Module: `mobile/android/app/src/main/assets/reader/reader.js`
```
// Large source tabs stay selectable without an expensive synchronous grammar pass.
function pebrelHighlight() {
  if (!window.hljs) return;
  document.querySelectorAll('pre code').forEach(function (block) {
    if (block.textContent.length > 262144) return;
    var language = (block.className.match(/language-([\w+-]+)/) || [])[1];
    if (language && hljs.getLanguage(language)) hljs.highlightElement(block);
  });
}
pebrelHighlight();
window.pebrelEnhance();

// Keep the reader's place and expanded tools while a running Agent adds messages.
window.pebrelRender = function (html, initial) {
  var root = document.scrollingElement || document.documentElement;
  var bottom = root.scrollHeight - window.innerHeight - window.scrollY < 80;
  var anchor = Array.from(document.querySelectorAll('[data-message]')).find(function (node) {
    return node.getBoundingClientRect().bottom > 0;
  });
  var anchorId = anchor && anchor.id;
  var anchorTop = anchor && anchor.getBoundingClientRect().top;
  var opened = new Set(Array.from(document.querySelectorAll('details[open]')).map(function (node) { return node.id; }));
  document.querySelector('main').innerHTML = html;
  document.querySelectorAll('details').forEach(function (node) { node.open = opened.has(node.id); });
  pebrelHighlight();
  var next = anchorId && document.getElementById(anchorId);
  if (initial || bottom) window.scrollTo(0, root.scrollHeight);
  else if (next) window.scrollBy(0, next.getBoundingClientRect().top - anchorTop);
  var settledY = window.scrollY;
  window.pebrelEnhance().then(function () {
    // 公式和图表完成后补偿高度；用户已经主动滚动时，不再抢回阅读位置。
    if (Math.abs(window.scrollY - settledY) > 4) return;
    if (initial || bottom) window.scrollTo(0, root.scrollHeight);
    else if (next && next.isConnected) window.scrollBy(0, next.getBoundingClientRect().top - anchorTop);
  });
};

```

### Core Architecture Module: `mobile/android/ghostty/src/main/cpp/bridge.h`
```
#pragma once
#include <jni.h>
#include <ghostty/vt.h>
#include <algorithm>
#include <cstdint>
#include <string>
#include <vector>

// All access is serialized by GhosttyCore. No Java/global references outlive a call.
struct Terminal {
    GhosttyTerminal vt = nullptr;
    GhosttyRenderState render = nullptr;
    GhosttyRenderStateRowIterator rows = nullptr;
    GhosttyRenderStateRowCells cells = nullptr;
    GhosttyKeyEncoder encoder = nullptr;
    GhosttyKeyEvent event = nullptr;
    std::vector<uint8_t> replies;
    bool overflow = false;
    bool force = true;
    bool title_changed = false;
    uint64_t history_rows = 1000;
    GhosttyTerminalScrollbar bounded_scrollbar();
    void seek_history(uint64_t offset);
    ~Terminal();
};

inline Terminal* terminal(jlong handle) { return reinterpret_cast<Terminal*>(handle); }
inline bool checked(JNIEnv* env, GhosttyResult result) {
    if (result == GHOSTTY_SUCCESS) return true;
    env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), "Terminal engine operation failed");
    return false;
}
inline jbyteArray bytes(JNIEnv* env, const uint8_t* data, size_t count) {
    auto result = env->NewByteArray(static_cast<jsize>(count));
    if (result && count) env->SetByteArrayRegion(result, 0, count, reinterpret_cast<const jbyte*>(data));
    return result;
}
inline jint argb(GhosttyColorRgb color) { return 0xff000000u | (color.r << 16) | (color.g << 8) | color.b; }
inline GhosttyColorRgb rgb(jint value) {
    return {static_cast<uint8_t>(value >> 16), static_cast<uint8_t>(value >> 8), static_cast<uint8_t>(value)};
}
#define JNI_METHOD(name) Java_io_github_kuddev_pebrel_terminal_NativeBridge_##name

```

### Core Architecture Module: `mobile/android/ghostty/src/main/cpp/pty.cpp`
```
#include "bridge.h"
#include <cerrno>
#include <csignal>
#include <cstdlib>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <sys/wait.h>
#include <termios.h>
#include <unistd.h>

static void io_error(JNIEnv* env, const char* message) {
    env->ThrowNew(env->FindClass("java/io/IOException"), message);
}

extern "C" JNIEXPORT jintArray JNICALL JNI_METHOD(ptyOpen)(JNIEnv* env, jobject, jstring directory, jstring startup, jint cols, jint rows) {
    const char* raw = env->GetStringUTFChars(directory, nullptr);
    if (!raw) return nullptr;
    const std::string cwd(raw);
    env->ReleaseStringUTFChars(directory, raw);
    const char* raw_startup = env->GetStringUTFChars(startup, nullptr);
    if (!raw_startup) return nullptr;
    const std::string shell_rc = "ENV=" + std::string(raw_startup);
    env->ReleaseStringUTFChars(startup, raw_startup);
    const std::string home = "HOME=" + cwd;
    const std::string temporary = "TMPDIR=" + cwd;
    const char* environment[] = {"PATH=/system/bin:/system/xbin", "TERM=xterm-256color", "COLORTERM=truecolor",
        "LANG=C.UTF-8", home.c_str(), temporary.c_str(), shell_rc.c_str(), nullptr};
    const char* arguments[] = {"/system/bin/sh", "-i", nullptr};
    int master = posix_openpt(O_RDWR | O_NOCTTY | O_CLOEXEC);
    char slave_name[128];
    if (master < 0) { io_error(env, "Cannot allocate local PTY"); return nullptr; }
    if (grantpt(master) || unlockpt(master) || ptsname_r(master, slave_name, sizeof(slave_name))) {
        close(master); io_error(env, "Cannot initialize local PTY"); return nullptr;
    }
    struct winsize size{};
    size.ws_col = cols;
    size.ws_row = rows;
    ioctl(master, TIOCSWINSZ, &size);
    const pid_t child = fork();
    if (child < 0) { close(master); io_error(env, "Cannot start local shell"); return nullptr; }
    if (child == 0) {
        // Only async-signal-safe libc/syscalls after fork in the multithreaded JVM.
        close(master);
        if (setsid() < 0) _exit(126);
        int slave = open(slave_name, O_RDWR);
        if (slave < 0 || ioctl(slave, TIOCSCTTY, 0) < 0) _exit(126);
        for (int fd = 0; fd < 3; ++fd) if (dup2(slave, fd) < 0) _exit(126);
        if (slave > 2) close(slave);
        if (chdir(cwd.c_str()) < 0) _exit(126);
        sigset_t mask;
        sigemptyset(&mask);
        sigprocmask(SIG_SETMASK, &mask, nullptr);
        execve(arguments[0], const_cast<char* const*>(arguments), const_cast<char* const*>(environment));
        _exit(127);
    }
    jint values[] = {master, child};
    auto result = env->NewIntArray(2);
    if (!result) { close(master); kill(child, SIGKILL); waitpid(child, nullptr, 0); return nullptr; }
    env->SetIntArrayRegion(result, 0, 2, values);
    return result;
}

extern "C" JNIEXPORT void JNICALL JNI_METHOD(ptyResize)(JNIEnv* env, jobject, jint fd, jint cols, jint rows, jint cw, jint ch) {
    struct winsize size{};
    size.ws_col = cols;
    size.ws_row = rows;
    size.ws_xpixel = std::min(cols * cw, 65535);
    size.ws_ypixel = std::min(rows * ch, 65535);
    if (ioctl(fd, TIOCSWINSZ, &size) < 0) io_error(env, "Cannot resize local PTY");
}

extern "C" JNIEXPORT void JNICALL JNI_METHOD(ptyStop)(JNIEnv*, jobject, jint pid) {
    if (pid > 0) {
        kill(-pid, SIGHUP);
        kill(-pid, SIGKILL);
        kill(pid, SIGKILL); // Also covers close racing with the child's setsid.
    }
}

extern "C" JNIEXPORT jint JNICALL JNI_METHOD(ptyWait)(JNIEnv* env, jobject, jint pid) {
    int status = 0;
    pid_t result;
    // The Kotlin transport holds its PID ownership lock for this nonblocking reap.
    // Close cannot signal a PID after it has been reaped and potentially reused.
    do { result = waitpid(pid, &status, WNOHANG); } while (result < 0 && errno == EINTR);
    if (result == 0) return INT32_MIN;
    if (result < 0) { io_error(env, "Cannot reap local shell"); return -1; }
    return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
}

```

### Core Architecture Module: `mobile/android/ghostty/src/main/cpp/render.cpp`
```
#include "bridge.h"

static void append_utf16(std::vector<jchar>& target, uint32_t codepoint) {
    if (codepoint > 0x10ffff || (codepoint >= 0xd800 && codepoint <= 0xdfff)) codepoint = 0xfffd;
    if (codepoint <= 0xffff) target.push_back(codepoint);
    else {
        codepoint -= 0x10000;
        target.push_back(0xd800 + (codepoint >> 10));
        target.push_back(0xdc00 + (codepoint & 0x3ff));
    }
}

extern "C" JNIEXPORT void JNICALL JNI_METHOD(render)(JNIEnv* env, jobject, jlong handle,
        jobjectArray output_rows, jintArray metadata) {
    auto* state = terminal(handle);
    // 页预算和可见历史行数分别限制；先夹紧视口，再读取对应的绘制行。
    const auto scrollbar = state->bounded_scrollbar();
    if (!checked(env, ghostty_render_state_update(state->render, state->vt))) return;
    uint16_t columns = 0, rows = 0, cx = 0, cy = 0;
    bool visible = false, in_viewport = false;
    GhosttyRenderStateDirty dirty{};
    GhosttyRenderStateCursorVisualStyle cursor_style{};
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_COLS, &columns);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_ROWS, &rows);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_DIRTY, &dirty);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VISIBLE, &visible);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_HAS_VALUE, &in_viewport);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_X, &cx);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_Y, &cy);
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_CURSOR_VISUAL_STYLE, &cursor_style);
    GhosttyRenderStateColors colors{};
    colors.size = sizeof(colors);
    if (!checked(env, ghostty_render_state_colors_get(state->render, &colors))) return;
    if (env->GetArrayLength(output_rows) != rows) {
        env->ThrowNew(env->FindClass("java/lang/IllegalArgumentException"), "Incorrect viewport row count");
        return;
    }
    jint meta[] = {columns, rows, cx, cy, visible && in_viewport, argb(colors.background),
        argb(colors.cursor_has_value ? colors.cursor : colors.foreground), static_cast<jint>(cursor_style),
        static_cast<jint>(std::min(scrollbar.total, uint64_t{INT32_MAX})),
        static_cast<jint>(std::min(scrollbar.offset, uint64_t{INT32_MAX}))};
    env->SetIntArrayRegion(metadata, 0, 10, meta);
    auto row_class = env->FindClass("io/github/kuddev/pebrel/terminal/TerminalRow");
    if (!row_class) return;
    auto constructor = env->GetMethodID(row_class, "<init>", "(Ljava/lang/String;[I)V");
    if (!constructor) return;
    ghostty_render_state_get(state->render, GHOSTTY_RENDER_STATE_DATA_ROW_ITERATOR, &state->rows);
    int y = -1;
    std::vector<uint32_t> codepoints;
    std::vector<jchar> text;
    std::vector<jint> cells(columns * 6);
    while (ghostty_render_state_row_iterator_next(state->rows)) {
        ++y;
        bool row_dirty = false;
        ghostty_render_state_row_get(state->rows, GHOSTTY_RENDER_STATE_ROW_DATA_DIRTY, &row_dirty);
        if (!state->force && dirty != GHOSTTY_RENDER_STATE_DIRTY_FULL && !row_dirty) continue;
        text.clear();
        ghostty_render_state_row_get(state->rows, GHOSTTY_RENDER_STATE_ROW_DATA_CELLS, &state->cells);
        int x = 0;
        while (ghostty_render_state_row_cells_next(state->cells)) {
            GhosttyCell raw{};
            GhosttyCellWide width{};
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_RAW, &raw);
            ghostty_cell_get(raw, GHOSTTY_CELL_DATA_WIDE, &width);
            auto foreground = colors.foreground, background = colors.background;
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_FG_COLOR, &foreground);
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_BG_COLOR, &background);
            GhosttyStyle style{};
            style.size = sizeof(style);
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_STYLE, &style);
            if (style.inverse) std::swap(foreground, background);
            const int cell_width = width == GHOSTTY_CELL_WIDE_WIDE ? 2 :
                (width == GHOSTTY_CELL_WIDE_NARROW ? 1 : 0);
            const int start = text.size();
            uint32_t length = 0;
            ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_LEN, &length);
            if (cell_width) {
                if (length) {
                    codepoints.resize(length);
                    ghostty_render_state_row_cells_get(state->cells, GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_BUF, codepoints.data());
                    for (auto codepoint : codepoints) append_utf16(text, codepoint);
                } else text.push_back(' ');
            }
            auto* cell = cells.data() + x * 6;
            cell[0] = start;
            cell[1] = text.size() - start;
            cell[2] = cell_width;
            cell[3] = argb(foreground);
            cell[4] = argb(background);
            cell[5] = (style.bold ? 1 : 0) | (style.italic ? 2 : 0) | (style.underline ? 4 : 0) |
                (style.strikethrough ? 8 : 0) | (style.faint ? 16 : 0) | (style.invisible ? 32 : 0);
            ++x;
        }
        auto row_text = env->NewString(text.data(), text.size());
        auto row_cells = env->NewIntArray(cells.size());
        if (!row_text || !row_cells) return;
        env->SetIntArrayRegion(row_cells, 0, cells.size(), cells.data());
        auto row = env->NewObject(row_class, constructor, row_text, row_cells);
        if (!row) return;
        env->SetObjectArrayElement(output_rows, y, row);
        env->DeleteLocalRef(row);
        env->DeleteLocalRef(row_text);
        env->DeleteLocalRef(row_cells);
        bool clean = false;
        ghostty_render_state_row_set(state->rows, GHOSTTY_RENDER_STATE_ROW_OPTION_DIRTY, &clean);
    }
    state->force = false;
    const GhosttyRenderStateDirty clean = GHOSTTY_RENDER_STATE_DIRTY_FALSE;
    ghostty_render_state_set(state->render, GHOSTTY_RENDER_STATE_OPTION_DIRTY, &clean);
}

```

### Core Architecture Module: `mobile/android/ghostty/src/main/cpp/terminal.cpp`
```
#include "bridge.h"
#include <memory>

Terminal::~Terminal() {
    ghostty_key_event_free(event);
    ghostty_key_encoder_free(encoder);
    ghostty_render_state_row_cells_free(cells);
    ghostty_render_state_row_iterator_free(rows);
    ghostty_render_state_free(render);
    ghostty_terminal_free(vt);
}

static void write_reply(GhosttyTerminal, void* userdata, const uint8_t* data, size_t length) {
    auto* state = static_cast<Terminal*>(userdata);
    if (length > 65536 - state->replies.size()) { state->overflow = true; return; }
    state->replies.insert(state->replies.end(), data, data + length);
}

static void title_changed(GhosttyTerminal, void* userdata) {
    static_cast<Terminal*>(userdata)->title_changed = true;
}

static uint64_t history_start(const Terminal& state, const GhosttyTerminalScrollbar& bar) {
    const uint64_t available = bar.total > bar.len ? bar.total - bar.len : 0;
    return available > state.history_rows ? available - state.history_rows : 0;
}

static void seek_native(Terminal& state, uint64_t offset) {
    GhosttyTerminalScrollViewport value{};
    value.tag = GHOSTTY_SCROLL_VIEWPORT_TOP;
    ghostty_terminal_scroll_viewport(state.vt, value);
    value.tag = GHOSTTY_SCROLL_VIEWPORT_DELTA;
    value.value.delta = static_cast<int64_t>(offset);
    ghostty_terminal_scroll_viewport(state.vt, value);
    state.force = true;
}

GhosttyTerminalScrollbar Terminal::bounded_scrollbar() {
    GhosttyTerminalScrollbar bar{};
    ghostty_terminal_get(vt, GHOSTTY_TERMINAL_DATA_SCROLLBAR, &bar);
    const auto first = history_start(*this, bar);
    if (bar.offset < first) { seek_native(*this, first); bar.offset = first; }
    bar.total -= first;
    bar.offset -= first;
    return bar;
}

void Terminal::seek_history(uint64_t offset) {
    GhosttyTerminalScrollbar bar{};
    ghostty_terminal_get(vt, GHOSTTY_TERMINAL_DATA_SCROLLBAR, &bar);
    const auto first = history_start(*this, bar);
    const auto maximum = bar.total > bar.len ? bar.total - bar.len : 0;
    seek_native(*this, std::min(first + offset, maximum));
}

extern "C" JNIEXPORT jlong JNICALL JNI_METHOD(create)(JNIEnv* env, jobject, jint cols, jint rows, jint scrollback) {
    if (scrollback < 0 || scrollback > 5000) {
        env->ThrowNew(env->FindClass("java/lang/IllegalArgumentException"), "Invalid history row limit");
        return 0;
    }
    auto state = std::make_unique<Terminal>();
    state->history_rows = scrollback;
    // 固定版本的 C 头文件误写为行，Screen 实际使用字节；不能把 1000 行传成 1000 字节。
    // 按支持的最大列宽和已核实的 64 位 Cell/Row 留出页开销，另用行窗口限制可回滚范围。
    const size_t history_bytes = scrollback == 0 ? 0 : std::min(size_t{16 * 1024 * 1024},
        static_cast<size_t>(scrollback) * (400 + 1) * sizeof(uint64_t) * 2 + 128 * 1024);
    if (!checked(env, ghostty_terminal_new(nullptr, &state->vt,
            {static_cast<uint16_t>(cols), static_cast<uint16_t>(rows), history_bytes})) ||
        !checked(env, ghostty_render_state_new(nullptr, &state->render)) ||
        !checked(env, ghostty_render_state_row_iterator_new(nullptr, &state->rows)) ||
        !checked(env, ghostty_render_state_row_cells_new(nullptr, &state->cells)) ||
        !checked(env, ghostty_key_encoder_new(nullptr, &state->encoder)) ||
        !checked(env, ghostty_key_event_new(nullptr, &state->event))) return 0;
    ghostty_terminal_set(state->vt, GHOSTTY_TERMINAL_OPT_USERDATA, state.get());
    ghostty_terminal_set(state->vt, GHOSTTY_TERMINAL_OPT_WRITE_PTY, reinterpret_cast<const void*>(write_reply));
    ghostty_terminal_set(state->vt, GHOSTTY_TERMINAL_OPT_TITLE_CHANGED, reinterpret_cast<const void*>(title_changed));
    // Images are not rendered by this adapter. Do not retain invisible image payloads.
    size_t no_images = 0;
    ghostty_terminal_set(state->vt, GHOSTTY_TERMINAL_OPT_KITTY_IMAGE_STORAGE_LIMIT, &no_images);
    return reinterpret_cast<jlong>(state.release());
}

extern "C" JNIEXPORT void JNICALL JNI_METHOD(destroy)(JNIEnv*, jobject, jlong handle) { delete terminal(handle); }

extern "C" JNIEXPORT jbyteArray JNICALL JNI_METHOD(feed)(JNIEnv* env, jobject, jlong handle, jbyteArray input, jint count) {
    auto* state = terminal(handle);
    std::vector<uint8_t> buffer(count);
    env->GetByteArrayRegion(input, 0, count, reinterpret_cast<jbyte*>(buffer.data()));
    if (env->ExceptionCheck()) return nullptr;
    state->replies.clear();
    state->overflow = false;
    ghostty_terminal_vt_write(state->vt, buffer.data(), buffer.size());
    if (state->overflow) {
        env->ThrowNew(env->FindClass("java/io/IOException"), "Terminal response exceeded bounded queue");
        return nullptr;
    }
    return bytes(env, state->replies.data(), state->replies.size());
}

extern "C" JNIEXPORT jbyteArray JNICALL JNI_METHOD(title)(JNIEnv* env, jobject, jlong handle) {
    auto* state = terminal(handle);
    if (!state->title_changed) return nullptr;
    state->title_changed = false;
    GhosttyString title{};
    ghostty_terminal_get(state->vt, GHOSTTY_TERMINAL_DATA_TITLE, &title);
    return bytes(env, title.ptr, std::min(title.len, size_t{512}));
}

extern "C" JNIEXPORT void JNICALL JNI_METHOD(resize)(JNIEnv* env, jobject, jlong handle, jint cols, jint rows, jint cw, jint ch) {
    auto* state = terminal(handle);
    checked(env, ghostty_terminal_resize(state->vt, cols, rows, cw, ch));
    state->force = true;
}

extern "C" JNIEXPORT void JNICALL JNI_METHOD(scroll)(JNIEnv*, jobject, jlong handle, jint delta) {
    auto* state = terminal(handle);
    GhosttyTerminalScrollViewport value{};
    value.tag = delta == INT32_MAX ? GHOSTTY_SCROLL_VIEWPORT_BOTTOM : GHOSTTY_SCROLL_VIEWPORT_DELTA;
    value.value.delta = delta;
    ghostty_terminal_scroll_viewport(state->vt, value);
    state->bounded_scrollbar();
    state->force = true;
}

extern "C" JNIEXPORT void JNICALL JNI_METHOD(scrollTo)(JNIEnv*, jobject, jlong handle, jint offset) {
    auto* state = terminal(handle);
    state->seek_history(static_cast<uint64_t>(std::max(offset, 0)));
}

extern "C" JNIEXPORT void JNICALL JNI_METHOD(colors)(JNIEnv* env, jobject, jlong handle, jintArray input) {
    auto* state = terminal(handle);
    jint values[19];
    env->GetIntArrayRegion(input, 0, 19, values);
    if (env->ExceptionCheck()) return;
    auto fg = rgb(values[0]), bg = rgb(values[1]), cursor = rgb(values[2]);
    GhosttyColorRgb palette[256];
    ghostty_terminal_get(state->vt, GHOSTTY_TERMINAL_DATA_COLOR_PALETTE_DEFAULT, &palette);
    for (int i = 0; i < 16; ++i) palette[i] = rgb(values[i + 3]);
    ghostty_terminal_set(state->vt, GHOSTTY_TERMINAL_OPT_COLOR_FOREGROUND, &fg);
    ghostty_terminal_set(state->vt, GHOSTTY_TERMINAL_OPT_COLOR_BACKGROUND, &bg);
    ghostty_terminal_set(state->vt, GHOSTTY_TERMINAL_OPT_COLOR_CURSOR, &cursor);
    ghostty_terminal_set(state->vt, GHOSTTY_TERMINAL_OPT_COLOR_PALETTE, &palette);
    state->force = true;
}

// Android keycodes are deliberately mapped here, never to native engine enum ordinals in Kotlin.
static GhosttyKey key(jint code) {
    if (code >= 29 && code <= 54) return static_cast<GhosttyKey>(GHOSTTY_KEY_A + code - 29);
    if (code >= 7 && code <= 16) return static_cast<GhosttyKey>(GHOSTTY_KEY_DIGIT_0 + code - 7);
    if (code >= 131 && code <= 142) return static_cast<GhosttyKey>(GHOSTTY_KEY_F1 + code - 131);
    switch (code) {
        case 19: return GHOSTTY_KEY_ARROW_UP;
        case 20: return GHOSTTY_KEY_ARROW_DOWN;
        case 21: return GHOSTTY_KEY_ARROW_LEFT;
        case 22: return GHOSTTY_KEY_ARROW_RIGHT;
        case 61: return GHOSTTY_KEY_TAB;
        case 62: return GHOSTTY_KEY_SPACE;
        case 66: return GHOSTTY_KEY_ENTER;
        case 67: return GHOSTTY_KEY_BACKSPACE;
        case 92: return GHOSTTY_KEY_PAGE_UP;
        case 93: return GHOSTTY_KEY_PAGE_DOWN;
        case 111: return GHOSTTY_KEY_ESCAPE;
        case 112: return GHOSTTY_KEY_DELETE;
        case 122: return GHOSTTY_KEY_HOME;
        case 123: return GHOSTTY_KEY_END;
        case 124: return GHOSTTY_KEY_INSERT;
        default: ret
```

### Core Architecture Module: `mobile/android/voice/src/main/cpp/whisper_jni.cpp`
```
#include <jni.h>
#include <whisper.h>
#include <algorithm>
#include <atomic>
#include <cmath>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace {
struct Job { std::atomic<bool> cancelled{false}; };
std::mutex registry_mutex;
std::unordered_map<jlong, std::shared_ptr<Job>> jobs;
jlong next_id = 1;
std::once_flag logging;

std::shared_ptr<Job> find(jlong id) {
    std::lock_guard<std::mutex> lock(registry_mutex);
    const auto found = jobs.find(id);
    return found == jobs.end() ? nullptr : found->second;
}
void fail(JNIEnv* env) {
    // Never include model paths, audio, or recognized text in diagnostics.
    env->ThrowNew(env->FindClass("java/io/IOException"), "local_transcription_failed");
}
bool abort_inference(void* data) { return static_cast<Job*>(data)->cancelled.load(); }
void discard_log(enum ggml_log_level, const char*, void*) {}
struct Samples {
    std::vector<float> value;
    ~Samples() { std::fill(value.begin(), value.end(), 0.f); }
};
}

extern "C" JNIEXPORT jlong JNICALL
Java_io_github_kuddev_pebrel_voice_NativeWhisper_create(JNIEnv* env, jobject) {
    try {
        std::lock_guard<std::mutex> lock(registry_mutex);
        if (jobs.size() >= 2) throw std::runtime_error("busy");
        const auto id = next_id++;
        jobs.emplace(id, std::make_shared<Job>());
        return id;
    } catch (...) { fail(env); return 0; }
}

extern "C" JNIEXPORT void JNICALL
Java_io_github_kuddev_pebrel_voice_NativeWhisper_cancel(JNIEnv*, jobject, jlong id) {
    if (auto job = find(id)) job->cancelled = true;
}

extern "C" JNIEXPORT void JNICALL
Java_io_github_kuddev_pebrel_voice_NativeWhisper_destroy(JNIEnv*, jobject, jlong id) {
    std::lock_guard<std::mutex> lock(registry_mutex);
    const auto found = jobs.find(id);
    if (found != jobs.end()) { found->second->cancelled = true; jobs.erase(found); }
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_io_github_kuddev_pebrel_voice_NativeWhisper_transcribe(
        JNIEnv* env, jobject, jlong id, jstring path, jfloatArray input) {
    try {
        auto job = find(id);
        if (!job || !path || !input) throw std::runtime_error("invalid_job");
        if (job->cancelled) return env->NewByteArray(0);
        const auto size = env->GetArrayLength(input);
        if (size < 4800 || size > 960000) throw std::runtime_error("invalid_audio");
        Samples samples;
        samples.value.resize(size);
        env->GetFloatArrayRegion(input, 0, size, samples.value.data());
        if (env->ExceptionCheck()) return nullptr;
        for (float value : samples.value) {
            if (!std::isfinite(value) || value < -1.f || value > 1.f) throw std::runtime_error("invalid_audio");
        }
        const char* utf = env->GetStringUTFChars(path, nullptr);
        if (!utf) return nullptr;
        std::string model;
        try { model.assign(utf); } catch (...) { env->ReleaseStringUTFChars(path, utf); throw; }
        env->ReleaseStringUTFChars(path, utf);
        std::call_once(logging, [] { whisper_log_set(discard_log, nullptr); });
        auto context_params = whisper_context_default_params();
        context_params.use_gpu = false;
        std::unique_ptr<whisper_context, decltype(&whisper_free)> context(
            whisper_init_from_file_with_params(model.c_str(), context_params), whisper_free);
        if (job->cancelled) return env->NewByteArray(0);
        if (!context) throw std::runtime_error("model_unavailable");
        auto params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
        params.n_threads = std::max(1u, std::min(4u, std::thread::hardware_concurrency()));
        params.language = "auto";
        params.translate = false;
        params.no_context = true;
        params.no_timestamps = true;
        params.print_progress = false;
        params.print_realtime = false;
        params.print_timestamps = false;
        params.print_special = false;
        params.suppress_blank = true;
        params.suppress_nst = true;
        params.abort_callback = abort_inference;
        params.abort_callback_user_data = job.get();
        const auto result = whisper_full(context.get(), params, samples.value.data(), size);
        if (job->cancelled) return env->NewByteArray(0);
        if (result != 0) throw std::runtime_error("inference_failed");
        std::string text;
        for (int i = 0; i < whisper_full_n_segments(context.get()); ++i) {
            if (whisper_full_get_segment_no_speech_prob(context.get(), i) > .8f) continue;
            const auto segment = whisper_full_get_segment_text(context.get(), i);
            if (segment) text += segment;
            if (text.size() > 32768) throw std::runtime_error("transcript_too_long");
        }
        auto output = env->NewByteArray(text.size());
        if (output) env->SetByteArrayRegion(output, 0, text.size(), reinterpret_cast<const jbyte*>(text.data()));
        return output;
    } catch (...) { fail(env); return nullptr; }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #395** (2026-09-30): **[Bug] Windows 终端代理对带 http:// 的系统代理地址重复添加协议头，导致 Pi 启动失败**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows 11 25H2 125% monitor 1  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  cmd  ### Program running in the pane / 面板里正在跑的程序  Pi  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  AI agent (Claude Code / Codex / Pi / OMP) — AI Agent 集成与状态  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤   1. 使用类似ProxyPin的软件开启系统代理。    2. 当时 Windows 注册表中的配置为：        路径：`HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Internet Settings`        ```text       ProxyEnable = 1       ProxyServer = http://127.0.0.1:9099       ```     3. 开启 Pebrel 的“终端代理”功能（配置文件中为 `terminal_proxy=1`）。    4. 在 Pebrel 中新建 CMD 标签页，执行：        ```bat       set HTTP_PROXY       set HTTPS_PROXY       pi       ```  ### Expected behavior / 期望结果  pi可以正常启动  ### Actual behavior / 实际结果  上述操作会导致多加一个协议头成为"http://http://127.0.0.1:9099"， 导致pi出现如下错误，拒绝启动，所有抓包软件应该都有这个问题   ### Logs / screenshots / 日志或截图  ``` InvalidArgumentError: invalid url      at Object.parseOrigin  (file:///D:/Tools/DevData/npm/node_modules/@earendil-works/pi-coding-agent/dist/bundle/chunks/chunk-OJP47DM6.js:2:35  940)      at new Client2  (file:///D:/Tools/DevData/npm/node_modules/@earendil-works/pi-coding-agent/dist/bund
  **Post-Mortem & Fix Analysis**:
  > 已在 main 修复：提交 d114ea83（随 PR #366 合入）。  Windows 系统代理地址已有 `http://`、`socks5://` 等协议头时会原样保留，仅对裸地址补充协议，避免生成 `http://http://...` 后污染新终端的代理环境变量。对应回归覆盖本报告的 `http://127.0.0.1:9099`，以及分协议配置、大小写协议、凭据和 IPv6 地址。  按已合入修复结项。请使用包含上述提交的构建验证；这里记录的是主分支修复状态，不将其视为旧发布包已经更新。若在包含修复的构建中新建终端后仍复现，请重新打开并补充版本与复现步骤。

- **Issue #363** (2026-09-29): **[Bug] Macos没有终端文字没有高亮显示**
  *Symptoms*: ### Operating system / 操作系统  macOS  ### OS version and display / 系统版本与显示  macos27  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  zsh  ### Program running in the pane / 面板里正在跑的程序  ssh client / remote shell — 远程 shell  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Terminal rendering / scrolling / selection / garbled text — 终端渲染、滚动、选区、乱码  ### Did it work in a previous version? / 旧版本是否正常？  No, it never worked / 一直如此  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  打开即可看见  ### Expected behavior / 期望结果  添加文字颜色  ### Actual behavior / 实际结果  没有文字颜色  ### Logs / screenshots / 日志或截图  没有文字颜色  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. It is missing details we need before anyone can reproduce it, so it is parked as `needs-info`. Please edit the issue and fill in: 感谢反馈。目前缺少复现所需的信息，已标记 `needs-info`。请**编辑 issue** 补齐以下内容，补齐后标签会自动移除：  - **Steps to reproduce / 复现步骤**: numbered steps from launch to the failing moment / 从启动开始按序写到出错那一步  Reports without these are closed after 14 days of silence. / 14 天无补充将关闭。

- **Issue #362** (2026-09-29): **[Bug] 部分键转换成了非 ASCII 字符**
  *Symptoms*: ### Operating system / 操作系统  macOS  ### OS version and display / 系统版本与显示  Macos27  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  zsh  ### Program running in the pane / 面板里正在跑的程序  ssh client / remote shell — 远程 shell  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  SSH / proxy / jump host — SSH、代理、跳板  ### Did it work in a previous version? / 旧版本是否正常？  No, it never worked / 一直如此  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  部分键转换成了非 ASCII 字符  ### Expected behavior / 期望结果  修复BUG  ### Actual behavior / 实际结果  部分键转换成了非 ASCII 字符  ### Logs / screenshots / 日志或截图  部分键转换成了非 ASCII 字符  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. It is missing details we need before anyone can reproduce it, so it is parked as `needs-info`. Please edit the issue and fill in: 感谢反馈。目前缺少复现所需的信息，已标记 `needs-info`。请**编辑 issue** 补齐以下内容，补齐后标签会自动移除：  - **Steps to reproduce / 复现步骤**: numbered steps from launch to the failing moment / 从启动开始按序写到出错那一步  Reports without these are closed after 14 days of silence. / 14 天无补充将关闭。

- **Issue #361** (2026-09-30): **[Bug] S3 备份无法连接阿里云 OSS**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  windows11  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  PowerShell 7 (pwsh)  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Other / 其他  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  - 存储服务：阿里云 OSS，S3 兼容接口 - 地域：华北 2（北京），`cn-beijing` 1. 打开 **设置 → 备份**，存储位置选择 S3 兼容存储。 2. 在“连接”页填写：    - 服务地址：`https://s3.oss-cn-beijing.aliyuncs.com`    - 区域：`cn-beijing`    - 存储桶：`<bucket>`    - Access Key ID / Secret Access Key：一个 RAM 用户的 AccessKey，该用户已被授予这个桶的列举、读取、写入权限 3. 点击 **检查连接并继续**。  ### Expected behavior / 期望结果  连接检查通过，进入“备份密码”步骤。   ### Actual behavior / 实际结果  备份操作失败: 认证失败：检查 S3 Access Key / Secret Key / 区域   ### Logs / screenshots / 日志或截图  排查结果  用同一组 AccessKey、同一个桶和地域，在 Pebrel 之外手动发送只读的列举请求（ListObjects）：  | 请求方式 | 地址 | 结果 | |---|---|---| | OSS 原生接口 | `https://<bucket>.oss-cn-beijing.aliyuncs.com/` | `200` 成功 | | S3 SigV4，虚拟主机式 | `https://<bucket>.s3.oss-cn-beijing.aliyuncs.com/` | `200` 成功 | | S3 SigV4，路径式 | `https://s3.oss-cn-beijing.aliyuncs.com/<bucket>` | `403` |   - AccessKey、Secret、RAM 权限和地域都没有问题，因为虚拟主机式请求能成功。 - 阿里云 OSS 的 S3 兼容接口**拒绝路径式请求**，只接受虚拟主机式。  另外试过把服务地址改成 `

- **Issue #354** (2026-09-30): **[Bug] 备份后无法更改存储位置**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows 11 24H2  ### Pebrel version / 版本号  2.0.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  PowerShell 7 (pwsh)  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Settings / theme / layout / blur — 设置页、主题、布局、模糊背景  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  1. 设置 2. 备份 3. 更改 4. 点击存储位置下拉框 5. 点击无响应  ### Expected behavior / 期望结果  可以点击切换  ### Actual behavior / 实际结果  点击下拉框无响应  ### Logs / screenshots / 日志或截图  <img width="1293" height="740" alt="Image" src="https://github.com/user-attachments/assets/ff9715bc-3dbc-4c25-ab13-f9834a264604" />  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息
  **Post-Mortem & Fix Analysis**:
  > 已由 PR #365 修复并合入 main（合并提交 84b007f5）。  原因是备份抽屉与下拉菜单的绘制层级冲突，菜单被抽屉覆盖。现在抽屉先绘制，下拉菜单位于其上，可以正常选择存储位置。  已有针对本 Issue 的回归 `issue_354_storage_menu_accepts_mouse_and_keyboard_inside_drawer`，覆盖真实鼠标选择、键盘选择、Escape 关闭菜单，以及取消抽屉后保留原存储配置。  按已合入修复结项。请使用包含上述提交的构建验证；这里记录的是主分支修复状态，不将其视为旧发布包已经更新。若仍复现，请重新打开并补充版本与操作步骤。

- **Issue #330** (2026-09-30): **[Bug] 代理加载环境变量问题**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows11 25H2  ### Pebrel version / 版本号    Version: 1.9.1  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  Windows PowerShell 5.1  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  SSH / proxy / jump host — SSH、代理、跳板  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  1.填写自定义代理 2.开启pebrel系统代理/关闭pebrel系统代理 3.开启新终端去Invoke-WebRequest https://www.google.com -UseBasicParsing -TimeoutSec 15  ### Expected behavior / 期望结果  网络页里填好自定义代理地址后，新开的本地终端会直接使用这个代理，不必再打开「系统代理」。 代理方式选「自定义代理」，并填上地址，例如 127.0.0.1:7897。之后新开的终端会带上 http_proxy、https_proxy 和 all_proxy。已经打开的终端不会变，需要再开一个。Windows 下变量名用小写，这样本机程序和 WSL 里的 curl 都能认到。 「系统代理」开关仍然只负责「跟随系统」：打开后，新终端才读取当前 Windows 系统代理。自定义地址不看这个开关。跳板和自定义命令只给 SSH 用，不会写进终端环境变量。 本机 GNU 工具链的 dlltool 无法启动，代理相关测试没有编译跑过。重新编译 Pebrel 后，新开一个终端，用 $env:http_proxy 可以核对地址。  <img width="2484" height="828" alt="Image" src="https://github.com/user-attachments/assets/3f4518c9-8502-4ec3-a15f-eba5516070b6" />  ### Actual behavior / 实际结果  1.开启代理和系统代理<img width="1695" height="911" alt="Image" src="https://github.com/user-attachments/assets/3aef6b3b-5ae4-4ff7-8afe-4aa0e3ce3655" /> 2.新建终端去测试代理可用性  <img width="1695
  **Post-Mortem & Fix Analysis**:
  > <!-- Failed to upload "pebrel-1.9.0-dev-src.zip" --> 用grok改出来的
  > <!-- Failed to upload "pebrel-1.9.1-dev-src.zip" -->

- **Issue #317** (2026-09-28): **[Bug] emoji无法正常显示**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  win 11  ### Pebrel version / 版本号  1.9.0  ### How did you install Pebrel? / 安装方式  GitHub Release (.exe / .zip / .dmg / .AppImage / .deb)  ### Shell in the affected pane / 出问题的面板用的 Shell  PowerShell 7 (pwsh)  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Terminal rendering / scrolling / selection / garbled text — 终端渲染、滚动、选区、乱码  ### Did it work in a previous version? / 旧版本是否正常？  No, it never worked / 一直如此  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  随便输入一些 emoji  <img width="722" height="433" alt="Image" src="https://github.com/user-attachments/assets/7e114094-d820-4432-8b8f-7897b88df7d6" />  ### Expected behavior / 期望结果  上图中的terminal显示的那样  ### Actual behavior / 实际结果  纯黑色的表情  ### Logs / screenshots / 日志或截图  <img width="722" height="433" alt="Image" src="https://github.com/user-attachments/assets/a21396ca-8626-47a2-af08-5f737124a450" />  ### Non-default settings / 改过的设置  _No response_  ### Before submitting / 提交前确认  - [x] I searched existing issues and did not find a duplicate / 已搜索，无重复 - [x] I tested with the latest release / 已用最新版本试过 - [x] I removed passwords, private keys, tokens and other secrets / 已删除敏感信息
  **Post-Mortem & Fix Analysis**:
  > 已核实修复通过集成 PR #338 合入 main（cff23341），其中保留了 #318 的原始修复提交。修正了 DirectWrite 彩色字形枚举顺序，并在合成前初始化透明背景；精确依赖版本的 Windows x64/ARM64 像素测试已实际执行并通过，集成 PR 的全部必需检查也已通过。按主线已修复关闭；这里记录的是 main 状态，正式发行情况以 Release 记录为准。

- **Issue #315** (2026-09-30): **[Bug] Debug build: changing the app icon overflows the main-thread stack in non-zh/en UI languages**
  *Symptoms*: ### Operating system / 操作系统  Windows  ### OS version and display / 系统版本与显示  Windows 11 25H2  ### Pebrel version / 版本号  1.9.1, debug build from source at 7b0cedb (current main)  ### How did you install Pebrel? / 安装方式  Built from source / 源码构建 (cargo build)  ### Shell in the affected pane / 出问题的面板用的 Shell  Windows PowerShell 5.1  ### Program running in the pane / 面板里正在跑的程序  Nothing, plain shell prompt / 什么都没跑  ### Connection type / 连接方式  Local terminal / 本地终端  ### Affected area / 影响范围  Settings / theme / layout / blur — 设置页、主题、布局、模糊背景  ### Did it work in a previous version? / 旧版本是否正常？  Not sure / 不确定  ### Can you reproduce it? / 复现概率  Always (100%) / 必现  ### Steps to reproduce / 复现步骤  1. Build and run a **debug** build: `cargo build --locked -p nebula --bin pebrel --features gpui-shell` 2. In Settings, set the UI language to anything other than 简体中文 / English. I reproduced it with Français and 日本語. 3. Open the app icon picker and change the icon.  ### Expected behavior / 期望结果  The icon picker renders and the icon changes.  ### Actual behavior / 实际结果  The process aborts:  ``` thread 'main' (9420) has overflowed its stack ```  Windows reports exception `0xc000041d` (`STATUS_FATAL_USER_CALLBACK_EXCEPTION`). The same steps do not crash with English or in a release build.  ### Logs / screenshots / 日志或截图  From git history, every release since **v1.8.1** has all three preconditions: `const MESSAGES` (added in 1552a5f), the icon grid's `pick(name_zh, name_en)` labels, and a catalog ent

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

### Incident Patch 1: `fb2c8057` (2026-09-30)
**Commit Message**: Merge remote-tracking branch 'origin/fix/theme-picker-polish-20260930' into release/prepare-2.1.0-20260930

**File**: `architecture/notes/mobile/android/2026-09-30-local-shell-color-ownership.md` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# Local interactive shell colors without rewriting user configuration
+
+## Status
+
+Implemented in the local PTY startup adapter.
+
+## Context
+
+The local PTY already advertised xterm-256color/truecolor, but Android's system
+`ls` did not emit colors by default. Changing the terminal renderer would not fix
+an uncolored byte stream.
+
+## Evidence
+
+The device's Toybox `ls --help` supports `--color=auto`, with colors for Unix file
+types. `SessionTransport.kt` owns local startup and `pty.cpp` supplies execve's
+environment; the terminal core already decodes ANSI colors.
+
+## Decision
+
+Generate an app-owned startup file inside private app storage on the IO worker.
+Replace it atomically and pass its path through `ENV` to the interactive system
+shell. Enable `ls --color=auto`, then source an existing user `.mkshrc` so explicit
+user preferences retain precedence. Do not overwrite the user's startup files.
+
+## Rejected alternatives
+
+- Force `--color=always`: contaminates pipes and redirected file output.
+- Add colors to rendered text by guessing filenames: changes terminal semantics.
+- Rewrite `$HOME/.mkshrc`: takes ownership of the user's configuration.
+- Advertise GNU `LS_COLORS` extension rules: this device's Toybox implements Unix
+  file-type colors rather than that GNU configuration contract.
+
+## Consequences
+
+Directories, links and executables are distinguishable in interactive listings;
+plain files retain their normal color. This is separate from dedicated file-type
+icons in the graphical browser. Explicit shell aliases may override the default.
+
+## Validation
+
+`GhosttyEngineTest` runs the real local PTY and inspects rendered colors for a
+directory, link and executable, then checks redirected listing bytes contain no ANSI.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+The local shell or bundled command utilities change their startup/color contract.
```

**File**: `architecture/notes/mobile/android/terminal/2026-09-30-history-capacity-and-scrollbar.md` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+# Bounded mobile history and a draggable viewport indicator
+
+## Status
+
+Implemented. Device acceptance is required before publication.
+
+## Context
+
+The native terminal retained a fixed 2000 history rows without a settings entry or
+a visible position indicator. The maintainer requested a default of 1000 rows,
+memory-aware limits and a scrollbar that can be dragged without selecting text.
+
+## Evidence
+
+The pinned C header describes `max_scrollback` as rows, but its C wrapper forwards
+the number unchanged to `Screen.Options.max_scrollback`, which is explicitly bytes.
+The device row-limit regression exposed this mismatch. `page.zig` defines both
+Cell and Row as packed 64-bit values. The C API also exposes a scrollbar tuple of
+total rows, viewport offset and visible length, but no runtime capacity setter.
+
+## Decision
+
+- `DisplayPreferences` owns the persisted row count, with a 1000-row default.
+  Low-RAM devices or memory classes at or below 128 MiB offer up to 1000 rows;
+  other devices offer up to 5000. These are product limits, not a memory-cost formula.
+- Apply a changed count to newly created local/SSH terminals. Do not recreate a
+  running terminal or silently discard its contents to apply a preference.
+- Keep a logical history window of at most the requested rows. Independently cap
+  native history pages at 16 MiB, budgeting for the supported 400-column maximum,
+  Cell/Row storage and page overhead. This is a byte budget, not an assertion of
+  exact per-row cost; complex graphemes may reduce available history under it.
+- Fetch scrollbar metadata once per visible native snapshot, not per cell or in
+  a separate polling loop. The frame's existing metadata fields keep their positions;
+  the appended fields are optional for desktop frames and prepared test fixtures.
+- Dragging the overlay changes viewport position through the terminal state worker.
+  It does not send shell input, resize the PTY or mutate terminal text. Desktop
+  mirrors use the same overlay geometry for the already available projected frame.
+- Keep the narrow visual thumb separate from its expanded edge hit region. Only
+  the thumb region starts dragging, leaving normal text gestures with the view.
+
+## Rejected alternatives
+
+- Recreate live sessions when the setting changes: destroys the user's working state.
+- Interpret a row-capacity preference as a swipe-speed multiplier: different semantics.
+- Inject arbitrary navigation keys to emulate history movement: may operate the
+  running TUI or command editor rather than move the terminal viewport.
+- Add a second history store in the view: duplicates native ownership and memory.
+
+## Consequences
+
+Both limits apply per terminal; native active pages and other engine structures are
+additional, and this is not a guarantee about total app memory across unlimited sessions.
+A desktop mirror can scroll only content supplied by its source;
+the overlay does not manufacture remote history or claim that all alternate-screen
+applications expose scrollback. Existing keyboard, selection and clipboard behavior
+must remain independently testable.
+
+## Validation
+
+Preference tests cover default, clamping and persistence. Native tests cover retained
+rows, absolute positions and a real Home-to-terminal scrollbar drag over 400 output
+lines. Clipboard regressions remain in the same real-device interaction flow.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+The upstream API supports changing limits without destroying live contents, or
+measurements justify different device classes or per-session limits.
```

**File**: `architecture/notes/mobile/android/terminal/2026-09-30-navigation-input-ownership.md` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+# 页面退出动画中的终端输入所有权
+
+## Status
+
+Implemented; validation is recorded below.
+
+## Context
+
+文件页的系统返回先取消多选，否则回到终端页面；目录层级由 `..` 导航，
+不再作为页面返回历史。页面动画会短暂保留已经退出的终端视图。
+
+## Evidence
+
+雷电 API 28 上复现：点击终端后马上打开 SFTP，`dumpsys input_method`
+在文件页报告 `mInputShown=true`，第一次返回只关闭键盘，多选仍保留。
+`GhosttyView.onSingleTapConfirmed` 在双击判定结束后才请求焦点和键盘；
+退出动画中的旧视图仍然 attached，单独检查 attached 状态不足以判断输入所有权。
+
+## Decision
+
+[MainActivity](../../../../../mobile/android/app/src/main/java/io/github/kuddev/pebrel/mobile/MainActivity.kt)
+将当前路由是否仍为终端传入
+[LocalTerminalScreen](../../../../../mobile/android/app/src/main/java/io/github/kuddev/pebrel/mobile/ui/TerminalScreen.kt)。
+终端的实际直接输入状态是用户选择与页面 active 状态的交集。
+离开页面即复用 `GhosttyView.directInput=false` 释放焦点、隐藏键盘；
+已排队的单击或键盘请求也通过原有 directInput 检查停止。
+
+## Rejected alternatives
+
+- 在文件页延迟隐藏键盘：无法证明延时晚于旧终端回调，还可能关闭用户刚打开的路径输入框。
+- 让返回键额外执行一次：掩盖错误的焦点归属，破坏系统 IME 与返回语义。
+- 把用户的直接输入偏好改为关闭：把临时页面生命周期泄漏进持久化设置。
+
+## Consequences
+
+退出视图可以继续绘制动画，但不再拥有终端输入焦点；返回终端时恢复原本的
+直接输入模式。没有新增延时、持久化字段或第二套键盘管理器。
+
+## Validation
+
+[SftpBrowserTest](../../../../../mobile/android/app/src/test/java/io/github/kuddev/pebrel/mobile/ui/SftpBrowserTest.kt)
+覆盖旧视图尚未销毁时停止直接输入与释放焦点，以及再次 active 后恢复原设置。
+目录导航、多选取消和页面返回使用同一组真实 Compose 布局测试。
+雷电 API 28 复测「点击终端后立即打开 SFTP」，文件页保持 `mInputShown=false`；
+紧接着的多选只需一次系统返回即可取消，不再先消耗一次返回关闭旧键盘。
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+页面导航不再保留退出动画视图，或终端输入会话改为由统一导航生命周期直接管理时，
+重新评估 active 参数；始终保留延迟单击不向已离开页面弹键盘的行为合同。
```

**File**: `architecture/notes/mobile/ssh/2026-09-30-key-document-authentication.md` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+# Android key-document authentication ownership
+
+## Status
+
+Implemented; validated through the mobile unit and native/device acceptance suites.
+
+## Context
+
+The host form exposed a disabled key choice while the native transport only tried
+none/password authentication. Enabling that control alone would not provide key login.
+
+## Evidence
+
+`HostForms.kt` selects a document; `SessionRepository` persists host metadata and
+encrypted credentials; `SshKeyFile.kt` reads bounded bytes on the SSH IO worker.
+`mobile/ssh/src/transport.rs` owns protocol authentication and host-key verification.
+
+## Decision
+
+- Reuse Android's document picker and persistable read grants, not a custom key vault
+  or a plaintext private-key field. Save URI/name only after the user saves the host.
+- Preserve the existing password credential identity. Key passphrases use an additional
+  key-URI discriminator, so switching modes or documents cannot reuse an old password.
+- Keep the original host-fingerprint checks. Explicit key mode uses public-key auth
+  only; malformed, inaccessible or rejected keys never select password as a fallback.
+- Accept at most 64 KiB; use the existing pinned russh key parser and RSA negotiation.
+  Keep byte-buffer clearing and native cancellation/lifetime ownership in their layers.
+
+## Rejected alternatives
+
+- Enable the button without a native path: creates a nonfunctional promise.
+- Put PEM bytes in host JSON or duplicate a key store: duplicates secret ownership.
+- Retry a failed key as a password: changes the user's explicit authentication choice.
+- Reimplement SSH key parsing/signing in Kotlin: duplicates the pinned protocol library.
+
+## Consequences
+
+Moving/revoking the selected document may require choosing it again. Its original
+provider owns storage; the app does not claim to encrypt that original file.
+Native credential buffers are temporary; managed/library internals are not claimed
+to have universal erasure guarantees. Unused persisted grants are released on removal.
+
+## Validation
+
+Existing Android UI tests cover enabled key selection and the required-document state.
+`SshIntegrationTest` creates ephemeral keys on the isolated OpenSSH fixture and checks
+Ed25519, encrypted keys, RSA/PEM, wrong passphrases and no password fallback, with SFTP.
+Device acceptance additionally uses the actual picker, saved host and reconnect path.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+The product adds managed key import, certificates, hardware keys or jump hosts.
```

**File**: `mobile/android/app/preview-proguard-rules.pro` (modified, +26/-0)
```diff
@@ -15,12 +15,38 @@
 -keep class kotlin.** { *; }
 # Resource IDs are accessed from the separate UI instrumentation APK.
 -keep class io.github.kuddev.pebrel.mobile.R$string { public static <fields>; }
+# Real-app touch tests observe the session opened through Home, rather than
+# substituting an Activity layout. Preserve only this javap-verified test boundary.
+-keepclassmembers class io.github.kuddev.pebrel.mobile.PebrelApplication {
+    public io.github.kuddev.pebrel.mobile.session.SessionRepository getSessions();
+    public android.graphics.Typeface terminalTypeface(java.lang.String);
+}
+-keepclassmembers class io.github.kuddev.pebrel.mobile.session.SessionRepository {
+    public kotlinx.coroutines.flow.StateFlow getSessions();
+    public io.github.kuddev.pebrel.mobile.session.DisplayPreferences getDisplay();
+    public void closeTerminal(java.lang.String);
+}
+-keepclassmembers class io.github.kuddev.pebrel.mobile.session.LocalSession {
+    public java.lang.String getId();
+    public java.lang.String getSource();
+    public java.lang.String getStatus();
+    public io.github.kuddev.pebrel.terminal.TerminalSession getTerminal();
+}
+-keepclassmembers class io.github.kuddev.pebrel.mobile.session.DisplayPreferences {
+    public kotlinx.coroutines.flow.StateFlow getState();
+}
+-keepclassmembers class io.github.kuddev.pebrel.mobile.session.TerminalPreferences {
+    public java.lang.String getFontFamily();
+    public int getFontSize();
+}
+-keep interface kotlinx.coroutines.flow.StateFlow { public *; }
 # Real OpenSSH regression uses these app-owned APIs across the test APK boundary.
 -keep class io.github.kuddev.pebrel.mobile.connection.HostProfile { public *; }
 -keep class io.github.kuddev.pebrel.mobile.connection.SshConnection { public *; }
 -keep class io.github.kuddev.pebrel.mobile.connection.SshTerminalTransport { public *; }
 -keep class io.github.kuddev.pebrel.mobile.connection.SshFailure { public *; }
 -keep enum io.github.kuddev.pebrel.mobile.connection.SshStage { *; }
+-keep enum io.github.kuddev.pebrel.mobile.connection.SshSessionMode { *; }
 -keep enum io.github.kuddev.pebrel.mobile.connection.SshFailureKind { *; }
 # The SFTP instrumentation exercises suspend APIs from a separate APK. Preserve
 # only its javap-verified public boundary; production release shrinking is unchanged.
```

---

### Incident Patch 2: `ac27a240` (2026-09-30)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/theme-picker-polish-20260930

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -5281,6 +5281,7 @@ dependencies = [
  "futures",
  "getrandom 0.3.4",
  "gl_generator",
+ "glob",
  "global-hotkey",
  "glutin",
  "gpui",
```

**File**: `README.md` (modified, +33/-1)
```diff
@@ -77,7 +77,39 @@ each agent's activity, and read its output without leaving the application.
 - On Windows, optional background residency keeps running sessions alive when you
   close the window. Restoring a conversation after the process exits is a separate
   feature and requires a supported CLI and a usable session identity.
-- History and path completions, configurable keybindings, and integrated shell prompts.
+- Context-aware and history completions, configurable keybindings, and integrated shell prompts.
+
+### Intelligent Completion
+
+Get suggestions from your current Git repository, project scripts, SSH config,
+and filesystem—even when you have never run the command before. On Windows,
+Pebrel also completes registered WSL distributions. These candidates come from
+Pebrel's own completion engine, without a shell completion plugin or an AI request.
+
+Five commands in a real Windows/PowerShell terminal: Git branches, npm scripts,
+SSH aliases, WSL distributions, and a quoted filename with `cat`. Typed one
+character at a time with the built-in Powerline prompt.
+
+<p align="center">
+  <img src="docs/screenshots/intelligent-completion.gif" alt="First-use completion for Git, npm, SSH, WSL, and cat in Pebrel" width="960" />
+</p>
+
+Choose **Inline** (Tab accepts the suggestion), **List** (Tab accepts the selected
+candidate), or **Hybrid** (→ accepts the inline suggestion; Tab opens the list)
+in Settings.
+
+<details>
+<summary>How history completion differs</summary>
+
+History completion recalls a command you have already executed. Here, `echo dep`
+recalls `echo deployment finished` after its first run. The five examples above
+discover candidates from the current environment without matching prior commands.
+
+<p align="center">
+  <img src="docs/screenshots/history-completion.gif" alt="Recalling a previously executed command with history completion" width="960" />
+</p>
+
+</details>
 
 ### SSH and Files
 
```

**File**: `README.zh-CN.md` (modified, +29/-1)
```diff
@@ -75,7 +75,35 @@ Pebrel（原名 Nebula）把本地 Shell、远程主机、文件和 AI 命令行
   可从当前会话元数据补全身份。
 - Windows 下可选择后台驻留，让关窗后的会话继续运行。进程退出后重新接续已保存的对话
   是另一项功能，需要 CLI 支持恢复，并且有可用的会话身份。
-- 历史记录与路径补全、自定义快捷键，以及集成的 Shell 提示符。
+- 智能补齐与历史补齐、自定义快捷键，以及集成的 Shell 提示符。
+
+### 智能补齐
+
+从当前 Git 仓库、项目脚本、SSH 配置和文件系统获取候选，第一次输入命令也能补齐。
+Windows 下还支持已注册的 WSL 发行版。这些候选由 Pebrel 自带的补齐引擎提供，
+无需 Shell 补齐插件或 AI 请求。
+
+下面在真实 Windows/PowerShell 终端中演示五种命令：Git 分支、npm 脚本、SSH 别名、
+WSL 发行版，以及 `cat` 读取带空格的文件名。使用内置 Powerline 提示符，逐字连续输入。
+
+<p align="center">
+  <img src="docs/screenshots/intelligent-completion.gif" alt="Pebrel 首次输入 Git、npm、SSH、WSL 和 cat 时的智能补齐" width="960" />
+</p>
+
+设置中可选择**行内补齐**（Tab 接受灰字）、**列表补齐**（Tab 接受选中候选），
+或**混合补齐**（→ 接受灰字，Tab 打开列表）。
+
+<details>
+<summary>历史补齐有什么不同？</summary>
+
+历史补齐回填已经执行过的命令。下面先运行 `echo deployment finished`，再输入
+`echo dep` 从历史中补齐；上面的五个例子则从当前环境发现候选，无需相应的命令历史。
+
+<p align="center">
+  <img src="docs/screenshots/history-completion.gif" alt="从历史记录补齐已执行过的命令" width="960" />
+</p>
+
+</details>
 
 ### SSH 与文件
 
```

**File**: `architecture/notes/mobile/android/2026-09-30-linear-file-icons.md` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+# Linear file icons with a bounded checked-in asset set
+
+## Status
+
+Implemented; visual acceptance is pending. The maintainer requested linear icons,
+recognizable file types and a performance-first, incremental implementation.
+
+## Context
+
+File lists and file tabs reused a generic file glyph. A first implementation reused
+the terminal's Nerd Font mapping, but its mixed filled glyphs did not meet the
+requested outline style. Phosphor's paper-plus-extension icons were then rejected:
+different resource IDs did not provide the expected visual identity, especially MD.
+
+## Evidence
+
+Tabler Outline provides the recognizable Markdown M/arrow, Rust gear, Python,
+JavaScript/TypeScript, React, Vue, Kotlin and other technology marks, alongside
+consistent folder, image, archive, document and configuration symbols.
+The pinned source revision, individual SVG/XML hashes and license hash are recorded
+in `mobile/android/third_party/file-icons.json`.
+`FileSymbols.kt` is the mobile display mapping shared by SFTP, Git and file tabs.
+
+## Decision
+
+Check in only the selected 50 VectorDrawable resources and preserve the original
+upstream paths/viewports and rounded strokes. Refresh them explicitly with `generate_file_icons.py`;
+ordinary builds do not download icons. Use static resource references and Compose's
+resource caching, not runtime name lookup or a new font-based renderer.
+Known technology types receive recognizable marks; image formats share a photo symbol.
+Types without a selected technology mark retain their code/category symbol; unknown
+extensions use the generic file. JSX/TSX use React, not a React Native label.
+
+## Rejected alternatives
+
+- Draw an entire icon set locally: duplicates mature geometry and visual maintenance.
+- Bundle a whole icon library or add another Gradle module for this small set: no
+  current requirement justifies the added build surface.
+- Add SymbolCraft in this change: the existing Android resource path already handles
+  the bounded selection. Its size claim is not evidence about this APK's total size.
+- Mix filled brand glyphs with linear file icons: conflicts with the requested style.
+- Use identical paper outlines with changing extension letters everywhere: the
+  maintainer's device review rejected this as poor recognition, despite passing tests.
+
+## Consequences
+
+The source XML totals about 59 KiB; actual APK size and frame cost are separate
+measurements. No universal speedup over XML or ImageVector is claimed. License
+attribution is bundled. New file types extend the same mapping and selected assets.
+
+## Validation
+
+Tests distinguish MD, Rust, Python, JSON, TOML, YAML, text, PNG, ZIP and PDF resources,
+check case/path handling and load real drawables. Device acceptance inspects the
+actual browser and file preview header, not Android's separate system picker.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+The bounded set or supported platforms outgrow the existing resource workflow, or a
+representative measured bottleneck justifies changing the loading representation.
```

**File**: `architecture/notes/mobile/android/2026-09-30-local-shell-color-ownership.md` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# Local interactive shell colors without rewriting user configuration
+
+## Status
+
+Implemented in the local PTY startup adapter.
+
+## Context
+
+The local PTY already advertised xterm-256color/truecolor, but Android's system
+`ls` did not emit colors by default. Changing the terminal renderer would not fix
+an uncolored byte stream.
+
+## Evidence
+
+The device's Toybox `ls --help` supports `--color=auto`, with colors for Unix file
+types. `SessionTransport.kt` owns local startup and `pty.cpp` supplies execve's
+environment; the terminal core already decodes ANSI colors.
+
+## Decision
+
+Generate an app-owned startup file inside private app storage on the IO worker.
+Replace it atomically and pass its path through `ENV` to the interactive system
+shell. Enable `ls --color=auto`, then source an existing user `.mkshrc` so explicit
+user preferences retain precedence. Do not overwrite the user's startup files.
+
+## Rejected alternatives
+
+- Force `--color=always`: contaminates pipes and redirected file output.
+- Add colors to rendered text by guessing filenames: changes terminal semantics.
+- Rewrite `$HOME/.mkshrc`: takes ownership of the user's configuration.
+- Advertise GNU `LS_COLORS` extension rules: this device's Toybox implements Unix
+  file-type colors rather than that GNU configuration contract.
+
+## Consequences
+
+Directories, links and executables are distinguishable in interactive listings;
+plain files retain their normal color. This is separate from dedicated file-type
+icons in the graphical browser. Explicit shell aliases may override the default.
+
+## Validation
+
+`GhosttyEngineTest` runs the real local PTY and inspects rendered colors for a
+directory, link and executable, then checks redirected listing bytes contain no ANSI.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+The local shell or bundled command utilities change their startup/color contract.
```

---

### Incident Patch 3: `9d473b39` (2026-09-30)
**Commit Message**: Merge branch 'main' into fix/mobile-icons-20260930

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -5281,6 +5281,7 @@ dependencies = [
  "futures",
  "getrandom 0.3.4",
  "gl_generator",
+ "glob",
  "global-hotkey",
  "glutin",
  "gpui",
```

**File**: `README.md` (modified, +33/-1)
```diff
@@ -77,7 +77,39 @@ each agent's activity, and read its output without leaving the application.
 - On Windows, optional background residency keeps running sessions alive when you
   close the window. Restoring a conversation after the process exits is a separate
   feature and requires a supported CLI and a usable session identity.
-- History and path completions, configurable keybindings, and integrated shell prompts.
+- Context-aware and history completions, configurable keybindings, and integrated shell prompts.
+
+### Intelligent Completion
+
+Get suggestions from your current Git repository, project scripts, SSH config,
+and filesystem—even when you have never run the command before. On Windows,
+Pebrel also completes registered WSL distributions. These candidates come from
+Pebrel's own completion engine, without a shell completion plugin or an AI request.
+
+Five commands in a real Windows/PowerShell terminal: Git branches, npm scripts,
+SSH aliases, WSL distributions, and a quoted filename with `cat`. Typed one
+character at a time with the built-in Powerline prompt.
+
+<p align="center">
+  <img src="docs/screenshots/intelligent-completion.gif" alt="First-use completion for Git, npm, SSH, WSL, and cat in Pebrel" width="960" />
+</p>
+
+Choose **Inline** (Tab accepts the suggestion), **List** (Tab accepts the selected
+candidate), or **Hybrid** (→ accepts the inline suggestion; Tab opens the list)
+in Settings.
+
+<details>
+<summary>How history completion differs</summary>
+
+History completion recalls a command you have already executed. Here, `echo dep`
+recalls `echo deployment finished` after its first run. The five examples above
+discover candidates from the current environment without matching prior commands.
+
+<p align="center">
+  <img src="docs/screenshots/history-completion.gif" alt="Recalling a previously executed command with history completion" width="960" />
+</p>
+
+</details>
 
 ### SSH and Files
 
```

**File**: `README.zh-CN.md` (modified, +29/-1)
```diff
@@ -75,7 +75,35 @@ Pebrel（原名 Nebula）把本地 Shell、远程主机、文件和 AI 命令行
   可从当前会话元数据补全身份。
 - Windows 下可选择后台驻留，让关窗后的会话继续运行。进程退出后重新接续已保存的对话
   是另一项功能，需要 CLI 支持恢复，并且有可用的会话身份。
-- 历史记录与路径补全、自定义快捷键，以及集成的 Shell 提示符。
+- 智能补齐与历史补齐、自定义快捷键，以及集成的 Shell 提示符。
+
+### 智能补齐
+
+从当前 Git 仓库、项目脚本、SSH 配置和文件系统获取候选，第一次输入命令也能补齐。
+Windows 下还支持已注册的 WSL 发行版。这些候选由 Pebrel 自带的补齐引擎提供，
+无需 Shell 补齐插件或 AI 请求。
+
+下面在真实 Windows/PowerShell 终端中演示五种命令：Git 分支、npm 脚本、SSH 别名、
+WSL 发行版，以及 `cat` 读取带空格的文件名。使用内置 Powerline 提示符，逐字连续输入。
+
+<p align="center">
+  <img src="docs/screenshots/intelligent-completion.gif" alt="Pebrel 首次输入 Git、npm、SSH、WSL 和 cat 时的智能补齐" width="960" />
+</p>
+
+设置中可选择**行内补齐**（Tab 接受灰字）、**列表补齐**（Tab 接受选中候选），
+或**混合补齐**（→ 接受灰字，Tab 打开列表）。
+
+<details>
+<summary>历史补齐有什么不同？</summary>
+
+历史补齐回填已经执行过的命令。下面先运行 `echo deployment finished`，再输入
+`echo dep` 从历史中补齐；上面的五个例子则从当前环境发现候选，无需相应的命令历史。
+
+<p align="center">
+  <img src="docs/screenshots/history-completion.gif" alt="从历史记录补齐已执行过的命令" width="960" />
+</p>
+
+</details>
 
 ### SSH 与文件
 
```

**File**: `architecture/notes/nebula_app/completion/2026-09-30-common-command-sources.md` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+# Common command arguments and connection destinations
+
+## Status
+
+Implemented; native platform validation is recorded with the change.
+
+## Context
+
+Generic filesystem candidates are wrong for an SSH destination, WSL distribution,
+grep pattern, or port number. A Windows path must also never fill a guest argument.
+These decisions belong to the shared completion pipeline, regardless of UI mode.
+
+## Evidence
+
+- [OpenSSH configuration](https://man.openbsd.org/ssh_config) permits Include
+  patterns relative to the user's `.ssh` directory and executable Match conditions.
+- [WSL commands](https://learn.microsoft.com/windows/wsl/basic-commands) distinguish
+  registered distributions, import/export host paths, and guest command lines.
+- Local OpenSSH 9.5 chooses the last repeated `-F`; local WSL rejects attached
+  `-dDebian` and `--distribution=Debian`. The semantic fixtures preserve these rules.
+- PowerShell's Unix compatibility policy leaves `ls`, `cp`, `mv`, `rm`, and `cat`
+  to native tools. CMD builtins have slash options; shell quoting is independent
+  from those command argument roles.
+
+## Decision
+
+Keep command metadata and argument roles in `nebula-completions::semantic::common`.
+The application owns connection discovery and a per-pane, two-second cache, with
+the same cancellation and generation invalidation as other completion sources.
+No additional executor or background service is introduced.
+
+Reuse the SSH config tokenizer and literal-host validator in `ssh::hosts`.
+Include traversal has a 1 MiB total read budget, 64-file and eight-level limits,
+4096 examined directory entries, 1024 aliases, and a cooperative 250 ms deadline.
+Blocking filesystem calls may exceed this deadline; all completion I/O remains on
+the existing worker. Cancellation discards partial results. Includes are sorted
+lexically; patterns/negated Host declarations are never invented as destinations.
+Runtime-dependent Include tokens and Match conditions are not evaluated.
+
+Add `glob` 0.3.4 as a direct dependency, reusing the version already in Cargo.lock.
+Only its pattern matcher is used: directory enumeration stays bounded here rather
+than allowing a library iterator to scan and sort an unbounded directory first.
+
+WSL registry discovery belongs to `platform::shell`. It does not start a guest;
+the picker retains its own plumbing-distro filter. Non-Windows hosts return no
+registered WSL destinations. SSH/WSL sessions reuse remote directory demand and
+never query the host connection cache. An execution snapshot identifying WSL
+overrides a stale local environment label before any source selection.
+Typed nested shells without a verified directory channel retain their scoped
+history for path arguments. An unavailable path source must not hide that history
+or fall back to the host filesystem; the existing issue-353 regression covers it.
+
+## Rejected alternatives
+
+- Running `ssh -G` during discovery: Match exec can run user code on every request.
+  The native fixture uses `-G` only after Enter, against isolated inert test config.
+- Starting WSL to list names: unnecessary cold-start work on the completion path.
+- Sharing host connection/project data with guests: same spelling does not imply
+  the same filesystem or configuration.
+- A generic command plugin framework: the current metadata needs no new lifecycle.
+
+## Consequences
+
+All three UI modes share the same candidates and quoting. Explicit option values,
+SSH login prefixes and jump chains retain their argument text. Unknown runtime
+shell expansions stay unsupported. Guest SSH configuration/known_hosts discovery,
+online WSL install catalogs, and guest paths for `wsl --cd` are not implemented by
+this change. The source does not claim to reproduce OpenSSH configuration resolution.
+
+## Validation
+
+Existing semantic, application and native completion fixtures cover argument
+roles, UTF-8 quoting, Include cycles/limits, host isol
```

**File**: `nebula-completions/src/command_context.rs` (modified, +45/-8)
```diff
@@ -36,23 +36,48 @@ struct Word {
 #[derive(Debug)]
 pub struct CommandContext {
     pub(crate) arguments: Vec<String>,
+    home_arguments: Vec<usize>,
     target: Word,
     syntax: ShellSyntax,
 }
 
 impl CommandContext {
     pub fn parse(line: &str, cursor: usize, syntax: ShellSyntax) -> Option<Self> {
+        Self::parse_words(line, cursor, syntax, false)
+    }
+
+    pub(crate) fn parse_with_home(line: &str, cursor: usize, syntax: ShellSyntax) -> Option<Self> {
+        Self::parse_words(line, cursor, syntax, true)
+    }
+
+    pub(crate) fn argument_expands_home(&self, index: usize) -> bool {
+        self.home_arguments.contains(&index)
+    }
+
+    fn parse_words(
+        line: &str,
+        cursor: usize,
+        syntax: ShellSyntax,
+        allow_home: bool,
+    ) -> Option<Self> {
         // 终端目前只证明行尾输入，不能借补齐覆盖光标右侧的未知内容。
         if cursor != line.len() || line.len() > 4096 {
             return None;
         }
         let mut words = words(line, syntax)?;
         let target = words.pop()?;
         // 已完成参数若含展开，无法证明它指向哪个目录；目标词的 home 由路径来源处理。
-        if words.iter().any(|word| !word.closed || word.home) {
+        if words.iter().any(|word| !word.closed || word.home && !allow_home) {
             return None;
         }
-        Some(Self { arguments: words.into_iter().map(|word| word.value).collect(), target, syntax })
+        let home_arguments =
+            words.iter().enumerate().filter_map(|(i, word)| word.home.then_some(i)).collect();
+        Some(Self {
+            arguments: words.into_iter().map(|word| word.value).collect(),
+            home_arguments,
+            target,
+            syntax,
+        })
     }
 
     pub fn prefix(&self) -> &str {
@@ -69,14 +94,26 @@ impl CommandContext {
             return None;
         }
         let quote = self.target.quote;
-        let safe = value.chars().all(|c| {
-            c.is_alphanumeric()
-                || matches!(c, '/' | '.' | '_' | '-' | ':' | '=')
-                || c == '\\' && matches!(self.syntax, ShellSyntax::PowerShell | ShellSyntax::Cmd)
-        });
+        // PowerShell 将 -Fconfig.conf 拆成参数 -Fconfig 和 .conf；整个词需引用。
+        // 普通选项仍保持裸写，否则 cmdlet 会把参数名当成位置参数。
+        let parameter_split = self.syntax == ShellSyntax::PowerShell
+            && value.starts_with('-')
+            && value.contains(['.', ':']);
+        let safe = !parameter_split
+            && value.chars().all(|c| {
+                c.is_alphanumeric()
+                    || matches!(c, '/' | '.' | '_' | '-' | ':' | '=')
+                    || c == '@'
+                        && self.syntax != ShellSyntax::Literal
+                        && (self.syntax != ShellSyntax::PowerShell || !value.starts_with('@'))
+                    || c == ',' && matches!(self.syntax, ShellSyntax::Posix | ShellSyntax::Cmd)
+                    || c == '\\'
+                        && matches!(self.syntax, ShellSyntax::PowerShell | ShellSyntax::Cmd)
+            });
         let cmd_quoted_safe = self.syntax == ShellSyntax::Cmd
             && value.chars().all(|c| {
-                c.is_alphanumeric() || matches!(c, '/' | '\\' | '.' | '_' | '-' | ':' | '=' | ' ')
+                c.is_alphanumeric()
+                    || matches!(c, '/' | '\\' | '.' | '_' | '-' | ':' | '=' | ' ' | '@' | ',')
             });
         let quoted = match (quote, self.syntax, safe) {
             (Some('\''), ShellSyntax::Posix, _) => format!("'{}'", value.replace('\'', "'\\''")),
```

---

### Incident Patch 4: `759da896` (2026-09-30)
**Commit Message**: Keep completion host adapters in platform and render the native fixture surface

**File**: `nebula_app/src/completion.rs` (modified, +0/-34)
```diff
@@ -344,40 +344,6 @@ mod tests {
         assert!(result.completion_items.is_empty(), "stale local labels must not read host paths");
     }
 
-    #[cfg(windows)]
-    #[test]
-    #[ignore = "requires a registered, runnable WSL distribution"]
-    fn common_completion_reads_and_executes_the_real_wsl_path() {
-        let distro = crate::platform::shell::registered_wsl_distros(&|| false)
-            .into_iter()
-            .find(|name| !name.starts_with("docker-desktop"))
-            .expect("registered WSL distro");
-        let env = SuggestEnv::Wsl { distro: distro.clone() };
-        let entries = crate::remote_dirs::fetch_wsl(&distro, "/etc").expect("guest directory");
-        assert!(entries.iter().any(|entry| entry.name == "os-release"));
-        crate::remote_dirs::finish_fetch(&env, "/etc", Some(entries));
-        for style in [CompletionStyle::Inline, CompletionStyle::Popup, CompletionStyle::Hybrid] {
-            let result = Session::default()
-                .request("/".into(), env.clone(), "cat /etc/os-re".into(), style, None)
-                .calculate(&Cancellation::default());
-            let edit = if style == CompletionStyle::Popup {
-                &result.completion_items[0]
-            } else {
-                result.suggestion_edit.as_ref().unwrap()
-            };
-            assert_eq!(edit.insert, "lease");
-        }
-        let mut command =
-            std::process::Command::new(crate::platform::shell::wsl_executable().unwrap());
-        crate::platform::process::hidden_command(&mut command);
-        let output = command
-            .args(["-d", &distro, "--exec", "/bin/cat", "/etc/os-release"])
-            .output()
-            .unwrap();
-        assert!(output.status.success());
-        assert!(String::from_utf8(output.stdout).unwrap().contains("NAME="));
-    }
-
     #[test]
     fn path_completion_preserves_quotes_utf8_types_and_directory_roles_in_all_modes() {
         use crate::display::NebulaCompletionKind;
```

**File**: `nebula_app/src/gpui_shell/terminal/view/completion_native_tests.rs` (modified, +18/-3)
```diff
@@ -2,10 +2,24 @@
 
 use super::*;
 use gpui::{EntityInputHandler as _, WindowBounds, WindowOptions, size};
+use gpui_component::ActiveTheme as _;
 use std::path::PathBuf;
 use std::sync::Mutex;
 use std::time::Duration;
 
+struct CompletionSurface(gpui::Entity<TerminalView>);
+
+impl gpui::Render for CompletionSurface {
+    fn render(
+        &mut self,
+        _: &mut gpui::Window,
+        cx: &mut gpui::Context<Self>,
+    ) -> impl gpui::IntoElement {
+        // 终端视图由正式卡片容器提供底色；独立验收窗口也必须补齐这个组合职责。
+        gpui::div().size_full().bg(cx.theme().background).child(self.0.clone())
+    }
+}
+
 async fn wait_for(
     cx: &mut gpui::AsyncApp,
     window: gpui::AnyWindowHandle,
@@ -190,7 +204,8 @@ fn git_completion_native_shell_end_to_end() {
             }, window, cx));
             window.focus(&view.read(cx).focus_handle.clone(), cx);
             terminal = Some(view.clone());
-            cx.new(|cx| gpui_component::Root::new(view, window, cx))
+            let surface = cx.new(|_| CompletionSurface(view));
+            cx.new(|cx| gpui_component::Root::new(surface, window, cx))
         }).unwrap();
         let terminal = terminal.unwrap();
         cx.spawn(async move |cx| {
@@ -279,8 +294,8 @@ fn git_completion_native_shell_end_to_end() {
                 for (mode, prefix, expected, suffix, branch, marker, right) in cases {
                     crate::gpui_shell::try_write_stderr(format_args!("native completion case: {mode:?} {prefix}"));
                     // Windows PowerShell 默认重定向为 UTF-16；证据文件统一显式 UTF-8。
-                    let suffix = if cfg!(windows) && (prefix.starts_with("ssh ") || prefix.starts_with("wsl ")) {
-                        suffix.replace(" > ", " | Out-File -Encoding utf8 ")
+                    let suffix = if prefix.starts_with("ssh ") || prefix.starts_with("wsl ") {
+                        crate::platform::shell::completion_qa_redirect(suffix)
                     } else { suffix.to_owned() };
                     if prefix.starts_with("git checkout --") {
                         std::fs::write(repository.path().join(marker.unwrap()), "modified").map_err(|error| error.to_string())?;
```

**File**: `nebula_app/src/platform/shell.rs` (modified, +47/-0)
```diff
@@ -163,6 +163,17 @@ pub(crate) fn registered_wsl_distros(cancelled: &dyn Fn() -> bool) -> Vec<String
     if cancelled() { Vec::new() } else { names }
 }
 
+/// Produce UTF-8 evidence with the native QA shell on each host.
+#[cfg(test)]
+pub(crate) fn completion_qa_redirect(suffix: &str) -> String {
+    // PowerShell 5 的默认重定向为 UTF-16；验收产物使用显式 UTF-8。
+    if cfg!(windows) {
+        suffix.replace(" > ", " | Out-File -Encoding utf8 ")
+    } else {
+        suffix.to_owned()
+    }
+}
+
 /// Keep the isolated Include fixture acceptable to native OpenSSH permission checks.
 #[cfg(test)]
 pub(crate) fn completion_qa_ssh_config_permissions(path: &std::path::Path) {
@@ -224,6 +235,42 @@ pub(crate) fn completion_qa_shell(_output: &std::path::Path) -> nebula_terminal:
 mod tests {
     use super::*;
 
+    #[cfg(windows)]
+    #[test]
+    #[ignore = "requires a registered, runnable WSL distribution"]
+    fn common_completion_reads_and_executes_the_real_wsl_path() {
+        use crate::completion::{Cancellation, Session};
+        use crate::display::{CompletionStyle, SuggestEnv};
+        let distro = crate::platform::shell::registered_wsl_distros(&|| false)
+            .into_iter()
+            .find(|name| !name.starts_with("docker-desktop"))
+            .expect("registered WSL distro");
+        let env = SuggestEnv::Wsl { distro: distro.clone() };
+        let entries = crate::remote_dirs::fetch_wsl(&distro, "/etc").expect("guest directory");
+        assert!(entries.iter().any(|entry| entry.name == "os-release"));
+        crate::remote_dirs::finish_fetch(&env, "/etc", Some(entries));
+        for style in [CompletionStyle::Inline, CompletionStyle::Popup, CompletionStyle::Hybrid] {
+            let result = Session::default()
+                .request("/".into(), env.clone(), "cat /etc/os-re".into(), style, None)
+                .calculate(&Cancellation::default());
+            let edit = if style == CompletionStyle::Popup {
+                &result.completion_items[0]
+            } else {
+                result.suggestion_edit.as_ref().unwrap()
+            };
+            assert_eq!(edit.insert, "lease");
+        }
+        let mut command =
+            std::process::Command::new(crate::platform::shell::wsl_executable().unwrap());
+        crate::platform::process::hidden_command(&mut command);
+        let output = command
+            .args(["-d", &distro, "--exec", "/bin/cat", "/etc/os-release"])
+            .output()
+            .unwrap();
+        assert!(output.status.success());
+        assert!(String::from_utf8(output.stdout).unwrap().contains("NAME="));
+    }
+
     #[cfg(all(not(windows), feature = "gpui-shell"))]
     #[test]
     fn unix_rejects_wsl_instead_of_selecting_another_shell() {
```

**File**: `nebula_app/src/ssh/hosts.rs` (modified, +2/-1)
```diff
@@ -130,7 +130,8 @@ impl Scan<'_> {
                     if pattern.matches_with(
                         &entry.file_name().to_string_lossy(),
                         glob::MatchOptions {
-                            case_sensitive: !cfg!(windows),
+                            case_sensitive: crate::platform::local_paths::completion_case_sensitive(
+                            ),
                             require_literal_separator: true,
                             require_literal_leading_dot: true,
                         },
```

---

### Incident Patch 5: `372888d2` (2026-09-30)
**Commit Message**: Reserve native test resources for the real Git completion fixture

**File**: `.config/nextest.toml` (modified, +6/-0)
```diff
@@ -8,3 +8,9 @@ theme-studio = { max-threads = 1 }
 [[profile.default.overrides]]
 filter = 'test(gpui_shell::settings_pane::theme_studio_tests::) or test(ctrl_wheel_font_zoom_toggle_gates_zoom_and_terminal_scroll) or test(ctrl_wheel_font_zoom_setting_is_searchable_and_has_a_visible_switch) or test(environment_refresh_switch_is_searchable_and_persists) or test(pasted_proxy_scheme_updates_the_visible_protocol_and_saved_url)'
 test-group = 'theme-studio'
+
+# 三模式夹具包含九个真实 Git/窗口场景；原生进程的墙钟期限不能用并发 UI 负载测试。
+# 只为此重型夹具保留资源，产品查询期限和用例断言保持不变。
+[[profile.default.overrides]]
+filter = 'test(=gpui_shell::terminal::view::startup_tests::git_completion_real_repository_reaches_all_modes_and_preserves_quoted_edits)'
+threads-required = 'num-test-threads'
```

**File**: `architecture/notes/scripts/ci/2026-09-30-git-fixture-resource-weight.md` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+# Reserve runner resources for the real Git completion fixture
+
+## Status
+
+Implemented for review; the complete native matrix validates the scheduling change.
+
+## Context
+
+The completion fixture exercises three modes and three quoting forms using real
+Git processes, GPUI tasks and PTY input assertions. Its application queries retain
+a three-second wall-clock lifetime. Running this nine-scenario fixture alongside
+other UI tests makes runner contention part of a correctness assertion.
+
+## Evidence
+
+In Windows x64 job `109811825765` of
+[run 36692156699](https://github.com/Kuddev/pebrel/actions/runs/36692156699),
+the fixture failed with `Process probe exceeded its time or output limit` and an
+empty branch snapshot in Hybrid mode. Its captured input, local environment and
+repository cwd were correct. Other UI tests were completing concurrently.
+
+On the same production revision, the local sequential GPUI completion run passed
+65 tests. The explicit native window/PowerShell/PTY/Git/npm test passed all eleven
+scenarios. Linux and both macOS native jobs also passed. These observations support
+a scheduling issue; a green rerun is still required rather than assumed.
+
+Nextest documents `threads-required = "num-test-threads"` for a heavy test which
+must run without competing tests:
+<https://nexte.st/docs/configuration/threads-required/>.
+The repository pins nextest 0.9.146.
+
+## Decision
+
+Give only this exact test a weight equal to the runner's test-thread count. Keep
+the existing settings-write group separate. All other tests retain their current
+parallelism; no test is excluded or retried, and no query deadline or assertion
+changes. The CI configuration contract enumerates both permitted overrides so a
+broad accidental serialization is rejected.
+
+## Rejected alternatives
+
+- Increase the production deadline again: CI load is not a product latency budget.
+- Retry until green: loses the failure signal without documenting resource needs.
+- Replace real Git with canned candidates: removes the source-to-PTY contract.
+- Serialize the complete suite: constrains unrelated lightweight tests.
+
+## Consequences
+
+The fixture briefly occupies all test slots on each native runner. This may
+increase total suite duration, but the bounded I/O test remains a functional
+integration check. It is not a contention benchmark or a production performance
+guarantee. Query cancellation, output bounds and cleanup tests still execute.
+
+## Validation
+
+The existing CI configuration contract checks the exact filter and resource weight
+alongside the unchanged settings group. The complete native matrix must pass the
+same assertions with the new scheduling before merge. No GUI source changes are
+included in this scheduling correction.
+
+## Supersedes
+
+None.
+
+## Revisit when
+
+The fixture is split along meaningful lifecycle boundaries, process discovery no
+longer owns a wall-clock deadline, or profiling demonstrates safe concurrency for
+this fixture under the current native runner resources.
```

**File**: `scripts/tests/test_ci_native_tests.py` (modified, +5/-1)
```diff
@@ -176,7 +176,7 @@ def test_native_workflow_installs_nextest_without_changing_release_callers(self)
         release = (root / ".github/workflows/release.yml").read_text(encoding="utf-8")
         self.assertIn("run: python scripts/ci_native_tests.py\n", release)
 
-    def test_nextest_serializes_only_fixtures_that_write_the_real_settings_file(self):
+    def test_nextest_reserves_only_shared_settings_and_the_heavy_git_fixture(self):
         root = Path(__file__).resolve().parents[2]
         config = tomllib.loads((root / ".config/nextest.toml").read_text(encoding="utf-8"))
         self.assertEqual(config["test-groups"], {"theme-studio": {"max-threads": 1}})
@@ -188,6 +188,10 @@ def test_nextest_serializes_only_fixtures_that_write_the_real_settings_file(self
                           " or test(environment_refresh_switch_is_searchable_and_persists)"
                           " or test(pasted_proxy_scheme_updates_the_visible_protocol_and_saved_url)",
                 "test-group": "theme-studio",
+            }, {
+                "filter": "test(=gpui_shell::terminal::view::startup_tests::"
+                          "git_completion_real_repository_reaches_all_modes_and_preserves_quoted_edits)",
+                "threads-required": "num-test-threads",
             }],
         })
 
```

---

### Incident Patch 6: `fec9ddfa` (2026-09-30)
**Commit Message**: Keep distribution regression checks within enabled update features

**File**: `nebula_app/src/platform/distribution.rs` (modified, +18/-14)
```diff
@@ -153,20 +153,24 @@ mod tests {
             assert_eq!(current(), expected);
             assert!(require_direct_update().is_err());
             assert!(crate::update_check::check_now().is_err());
-            let asset = crate::update_check::UpdateAsset {
-                version: "0.0.0".into(),
-                name: String::new(),
-                download_url: String::new(),
-                size: None,
-                sha256: None,
-            };
-            assert!(crate::update_download::begin(&asset).is_err());
-            assert!(crate::update_download::handoff::prepare(&asset).is_err());
-            assert!(crate::update_download::handoff::schedule(&asset).is_err());
-            assert!(!crate::update_download::handoff::apply_scheduled());
-            assert!(!crate::update_download::handoff::installation_in_progress().unwrap());
-            crate::update_download::hydrate();
-            assert!(crate::update_download::cached_asset().is_none());
+            // 旧壳仍校验安装归属；更新下载模块只在 GPUI 产品中存在。
+            #[cfg(feature = "gpui-shell")]
+            {
+                let asset = crate::update_check::UpdateAsset {
+                    version: "0.0.0".into(),
+                    name: String::new(),
+                    download_url: String::new(),
+                    size: None,
+                    sha256: None,
+                };
+                assert!(crate::update_download::begin(&asset).is_err());
+                assert!(crate::update_download::handoff::prepare(&asset).is_err());
+                assert!(crate::update_download::handoff::schedule(&asset).is_err());
+                assert!(!crate::update_download::handoff::apply_scheduled());
+                assert!(!crate::update_download::handoff::installation_in_progress().unwrap());
+                crate::update_download::hydrate();
+                assert!(crate::update_download::cached_asset().is_none());
+            }
             let executable = std::env::current_exe().unwrap();
             assert!(!executable.parent().unwrap().join(".pebrel-update.nebula-lock").exists());
             return;
```

---

### Incident Patch 7: `590a360c` (2026-09-30)
**Commit Message**: Keep native completion shell fixtures at the platform boundary

**File**: `nebula_app/src/gpui_shell/terminal/view/completion_native_tests.rs` (modified, +1/-28)
```diff
@@ -53,34 +53,7 @@ fn git_completion_native_shell_end_to_end() {
     for branch in ["qa/inline", "qa/popup", "qa/hybrid", "qa/right"] {
         crate::git_completion::tests::git(repository.path(), &["branch", branch]);
     }
-    #[cfg(windows)]
-    let shell = {
-        let integrated = nebula_terminal::tty::powershell_with_nebula_integration(
-            "powershell.exe".into(),
-            vec!["-NoLogo".into(), "-NoProfile".into()],
-        );
-        let mut args = integrated.args().to_vec();
-        args.last_mut().unwrap().push_str("; Set-PSReadLineOption -HistorySaveStyle SaveNothing; if ((Get-Command Set-PSReadLineOption).Parameters.ContainsKey('PredictionSource')) { Set-PSReadLineOption -PredictionSource None }");
-        nebula_terminal::tty::Shell::new(integrated.program().to_owned(), args)
-    };
-    #[cfg(unix)]
-    let shell = {
-        let rcfile = output.join("bashrc");
-        std::fs::write(
-            &rcfile,
-            "PS1='\\[\\e]133;A\\a\\]QA> \\[\\e]133;B\\a\\]'\nunset PROMPT_COMMAND\n",
-        )
-        .unwrap();
-        nebula_terminal::tty::Shell::new(
-            "bash".into(),
-            vec![
-                "--noprofile".into(),
-                "--rcfile".into(),
-                rcfile.to_string_lossy().into_owned(),
-                "-i".into(),
-            ],
-        )
-    };
+    let shell = crate::platform::shell::completion_qa_shell(&output);
     let result = Arc::new(Mutex::new(None));
     let after = result.clone();
     gpui_platform::application().with_assets(crate::gpui_shell::assets::NebulaAssets).run(move |cx| {
```

**File**: `nebula_app/src/platform/shell.rs` (modified, +33/-0)
```diff
@@ -136,6 +136,39 @@ pub(crate) fn default_wsl_distro() -> Option<String> {
     }
 }
 
+/// Isolated native-shell fixture for completion acceptance on every desktop host.
+#[cfg(test)]
+pub(crate) fn completion_qa_shell(_output: &std::path::Path) -> nebula_terminal::tty::Shell {
+    #[cfg(windows)]
+    {
+        let integrated = nebula_terminal::tty::powershell_with_nebula_integration(
+            "powershell.exe".into(),
+            vec!["-NoLogo".into(), "-NoProfile".into()],
+        );
+        let mut args = integrated.args().to_vec();
+        args.last_mut().unwrap().push_str("; Set-PSReadLineOption -HistorySaveStyle SaveNothing; if ((Get-Command Set-PSReadLineOption).Parameters.ContainsKey('PredictionSource')) { Set-PSReadLineOption -PredictionSource None }");
+        nebula_terminal::tty::Shell::new(integrated.program().to_owned(), args)
+    }
+    #[cfg(unix)]
+    {
+        let rcfile = _output.join("bashrc");
+        std::fs::write(
+            &rcfile,
+            "PS1='\\[\\e]133;A\\a\\]QA> \\[\\e]133;B\\a\\]'\nunset PROMPT_COMMAND\n",
+        )
+        .unwrap();
+        nebula_terminal::tty::Shell::new(
+            "bash".into(),
+            vec![
+                "--noprofile".into(),
+                "--rcfile".into(),
+                rcfile.to_string_lossy().into_owned(),
+                "-i".into(),
+            ],
+        )
+    }
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
```

---

### Incident Patch 8: `79272948` (2026-09-30)
**Commit Message**: Merge branch 'main' into fix/mobile-selection-curated-20260930



---

### Incident Patch 9: `7df04341` (2026-09-30)
**Commit Message**: Merge branch 'main' into fix/mobile-recovery-curated-20260930



---

### Incident Patch 10: `1315d9cd` (2026-09-30)
**Commit Message**: Merge desktop control hit target fixes from PR #285

**File**: `nebula_app/src/gpui_shell/settings_pane.rs` (modified, +3/-3)
```diff
@@ -33,7 +33,7 @@ use std::time::Duration;
 
 use crate::gpui_shell::config::{DEFAULT_CURSOR_BLINK, effective_cursor_blink};
 use crate::gpui_shell::prelude::*;
-use crate::gpui_shell::widgets::NebulaButton;
+use crate::gpui_shell::widgets::{NebulaButton, settings_control_height};
 
 mod about;
 mod agents;
@@ -687,7 +687,7 @@ impl SettingsPane {
                 .debug_selector(move || format!("settings-select-{key}"))
                 .w(px(SETTINGS_SELECT_WIDTH))
                 .text_color(cx.theme().link)
-                .children(select.map(|state| Select::new(&state)))
+                .children(select.map(|state| Select::new(&state).h(settings_control_height(cx))))
                 .into_any_element()
         });
         self.maybe_marked(key, label, desc, control, cx)
@@ -702,7 +702,7 @@ impl SettingsPane {
                 .w(px(SETTINGS_SELECT_WIDTH))
                 .font_family(cx.theme().mono_font_family.clone())
                 .text_color(cx.theme().link)
-                .child(Select::new(&self.shell_select)),
+                .child(Select::new(&self.shell_select).h(settings_control_height(cx))),
             cx,
         )
     }
```

**File**: `nebula_app/src/gpui_shell/settings_pane/design.rs` (modified, +3/-3)
```diff
@@ -127,7 +127,7 @@ impl SettingsPane {
         let reset = dirty.then(|| {
             div()
                 .id(SharedString::from(format!("setting-reset-{label}")))
-                .size(px(20.0))
+                .size(px(32.0))
                 .rounded_md()
                 .flex()
                 .items_center()
@@ -144,7 +144,7 @@ impl SettingsPane {
                     .build(window, cx)
                 })
                 .on_click(cx.listener(move |this, _, window, cx| on_reset(this, window, cx)))
-                .child(Icon::new(IconName::Undo2).xsmall())
+                .child(Icon::new(IconName::Undo2).size(px(16.0)))
                 .into_any_element()
         });
         self.row_shell(label, desc.into(), reset, dirty, RowLayout::Standard, control, cx)
@@ -239,7 +239,7 @@ impl SettingsPane {
                             Button::new(SharedString::from(format!("settings-help-{label}")))
                                 .icon(IconName::Info)
                                 .ghost()
-                                .size(px(22.0))
+                                .size(px(32.0))
                                 .text_color(theme.muted_foreground)
                                 .accessibility_id(SharedString::from(format!(
                                     "settings-help-{label}"
```

**File**: `nebula_app/src/gpui_shell/settings_pane/segmented.rs` (modified, +2/-4)
```diff
@@ -31,17 +31,15 @@ impl SettingsPane {
             )))
             .w(px(SETTINGS_SELECT_WIDTH))
             .max_w_full()
-            .small()
             .outline()
             .children(values.iter().copied().zip(labels).enumerate().map(
                 |(index, (value, label))| {
                     Button::new(SharedString::from(format!("settings-choice-{key}-{value}")))
                         .debug_selector(move || format!("settings-choice-{key}-{value}"))
                         .flex_1()
                         .min_w_0()
-                        .small()
-                        .h(px(28.0))
-                        .rounded(px(14.0))
+                        .h(settings_control_height(cx))
+                        .rounded(px(6.0))
                         .selected(index == selected)
                         .label(label)
                         .on_click(cx.listener(move |this, _, window, cx| {
```

**File**: `nebula_app/src/gpui_shell/widgets.rs` (modified, +21/-3)
```diff
@@ -16,8 +16,8 @@ use std::sync::Arc;
 
 use gpui::prelude::FluentBuilder as _;
 use gpui::{
-    App, ClickEvent, ElementId, IntoElement, ParentElement as _, RenderImage, RenderOnce,
-    SharedString, Styled as _, Window, div, px,
+    App, ClickEvent, ElementId, InteractiveElement as _, IntoElement, ParentElement as _,
+    RenderImage, RenderOnce, SharedString, Styled as _, Window, div, px,
 };
 use gpui_component::button::{Button, ButtonVariants as _};
 use gpui_component::switch::Switch;
@@ -51,6 +51,20 @@ pub fn shell_brand_image(
     Some(Arc::new(RenderImage::new([Frame::new(rgba)])))
 }
 
+/// Desktop form controls keep their padding even with a small UI font.
+pub(crate) fn settings_control_height(cx: &App) -> gpui::Pixels {
+    px(f32::from(cx.theme().font_size).max(16.0) * 2.0)
+}
+
+/// Toolbar glyphs and their hover/hit surfaces have independent logical sizes.
+pub(crate) fn toolbar_button(id: impl Into<ElementId>, icon: impl Into<Icon>) -> Button {
+    Button::new(id).icon(Icon::new(icon).size(px(18.0))).ghost().size(px(32.0))
+}
+
+#[cfg(all(test, feature = "gpui-test-support"))]
+#[path = "widgets_tests.rs"]
+mod tests;
+
 /// 设置行开关。组件库 `Switch` 的转发壳——`on_click` 与它同签名
 /// （`Fn(&bool, &mut Window, &mut App)`，参数是**点击后**的目标值）。
 #[derive(IntoElement)]
@@ -187,8 +201,12 @@ impl NebulaButton {
 }
 
 impl RenderOnce for NebulaButton {
-    fn render(self, _: &mut Window, _: &mut App) -> impl IntoElement {
+    fn render(self, _: &mut Window, cx: &mut App) -> impl IntoElement {
+        let key = self.key.clone();
         let button = Button::new(ElementId::Name(format!("nebula-btn-{}", self.key).into()))
+            .debug_selector(move || format!("nebula-btn-{key}"))
+            .h(settings_control_height(cx))
+            .px(px(12.0))
             .label(self.label)
             .disabled(self.disabled);
         // Default 走 outline：设置行里的动作按钮需要一条边把自己从行底分出来，
```

**File**: `nebula_app/src/gpui_shell/widgets_tests.rs` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+use std::{cell::Cell, rc::Rc};
+
+use gpui::{AppContext as _, Context, Modifiers, Render, TestAppContext, point};
+use gpui_component::{IconName, Root, Theme, h_flex};
+
+use super::*;
+
+struct ControlProbe(Rc<Cell<usize>>);
+
+impl Render for ControlProbe {
+    fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
+        let action = self.0.clone();
+        let tool = self.0.clone();
+        let disabled = self.0.clone();
+        h_flex()
+            .gap(px(8.0))
+            .child(
+                NebulaButton::new("comfort-action")
+                    .label("查看详情 / Details")
+                    .on_click(move |_, _, _| action.set(action.get() + 1)),
+            )
+            .child(
+                toolbar_button("comfort-tool", IconName::Settings)
+                    .debug_selector(|| "comfort-tool".to_owned())
+                    .on_click(move |_, _, _| tool.set(tool.get() + 1)),
+            )
+            .child(
+                NebulaButton::new("comfort-disabled")
+                    .label("Disabled")
+                    .disabled(true)
+                    .on_click(move |_, _, _| disabled.set(disabled.get() + 1)),
+            )
+    }
+}
+
+#[gpui::test]
+fn desktop_controls_keep_padding_clickable_with_small_ui_fonts(cx: &mut TestAppContext) {
+    cx.update(gpui_component::init);
+    let clicks = Rc::new(Cell::new(0));
+    let (_, cx) = cx.add_window_view(|window, cx| {
+        let view = cx.new(|_| ControlProbe(clicks.clone()));
+        Root::new(view, window, cx)
+    });
+    cx.simulate_resize(gpui::size(px(1000.0), px(200.0)));
+    for (font, height) in [(10.0, 32.0), (14.0, 32.0), (24.0, 48.0)] {
+        cx.update(|window, cx| {
+            Theme::global_mut(cx).font_size = px(font);
+            window.refresh();
+            let _ = window.draw(cx);
+        });
+        let action = cx.debug_bounds("nebula-btn-comfort-action").expect("text button");
+        let tool = cx.debug_bounds("comfort-tool").expect("toolbar button");
+        let disabled = cx.debug_bounds("nebula-btn-comfort-disabled").expect("disabled button");
+        assert!(action.size.height >= px(height));
+        assert_eq!(tool.size, gpui::size(px(32.0), px(32.0)));
+        let before = clicks.get();
+        // These corners are padding, not glyphs: the whole surface must activate.
+        for bounds in [action, tool, disabled] {
+            cx.simulate_click(
+                point(bounds.origin.x + px(2.0), bounds.bottom() - px(2.0)),
+                Modifiers::default(),
+            );
+        }
+        assert_eq!(clicks.get(), before + 2, "disabled padding must not activate");
+    }
+}
```

#### Recent Merged Pull Requests:
- **PR #413** (2026-09-30): Polish theme settings and preserve independent color edits (@Kuddev)
- **PR #412** (2026-09-30): Prepare Pebrel 2.1.0 with latest desktop and Android improvements (@Kuddev)
- **PR #411** (2026-09-30): Improve mobile terminal history selection and rendering (@Kuddev)
- **PR #410** (2026-09-30): Improve mobile key authentication and file selection (@Kuddev)
- **PR #408** (2026-09-30): Show five common completion commands in the README (@Kuddev)
- **PR #407** (2026-09-30): Add lightweight mobile file type icons (@Kuddev)
- **PR #406** (2026-09-30): Complete SSH WSL and common command arguments across platforms (@Kuddev)
- **PR #405** (2026-09-30): Complete automatic Git tracking branches from repository configuration (@Kuddev)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
