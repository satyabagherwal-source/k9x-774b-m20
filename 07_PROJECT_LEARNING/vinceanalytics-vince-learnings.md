# Forensic Learning Record (Deep Inspection): vinceanalytics/vince

> **Canonical Artifact**: `07_PROJECT_LEARNING/vinceanalytics-vince-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vinceanalytics/vince](https://github.com/vinceanalytics/vince))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:14:11.575Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vinceanalytics/vince`
- **Description**: Self Hosted Alternative To Google Analytics
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 2014 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/embed.go`
```
package app

import (
	"embed"
)

//go:embed public
var Public embed.FS

//go:embed images
var Images embed.FS

//go:embed js
var Scripts embed.FS

```

### Core Architecture Module: `app/js/script.compat.exclusions.file-downloads.hash.js`
```
!function(){"use strict";var l=window.location,o=window.document,p=o.getElementById("plausible"),s=p.getAttribute("data-api")||(f=(f=p).src.split("/"),d=f[0],f=f[2],d+"//"+f+"/api/event");function c(e,t){e&&console.warn("Ignoring Event: "+e),t&&t.callback&&t.callback()}function e(e,t){if(/^localhost$|^127(\.[0-9]+){0,2}\.[0-9]+$|^\[::1?\]$/.test(l.hostname)||"file:"===l.protocol)return c("localhost",t);if((window._phantom||window.__nightmare||window.navigator.webdriver||window.Cypress)&&!window.__plausible)return c(null,t);try{if("true"===window.localStorage.plausible_ignore)return c("localStorage flag",t)}catch(e){}var a=p&&p.getAttribute("data-include"),i=p&&p.getAttribute("data-exclude");if("pageview"===e){a=!a||a.split(",").some(n),i=i&&i.split(",").some(n);if(!a||i)return c("exclusion rule",t)}function n(e){var t=l.pathname;return(t+=l.hash).match(new RegExp("^"+e.trim().replace(/\*\*/g,".*").replace(/([^\.])\*/g,"$1[^\\s/]*")+"/?$"))}var a={},r=(a.n=e,a.u=l.href,a.d=p.getAttribute("data-domain"),a.r=o.referrer||null,t&&t.meta&&(a.m=JSON.stringify(t.meta)),t&&t.props&&(a.p=t.props),a.h=1,new XMLHttpRequest);r.open("POST",s,!0),r.setRequestHeader("Content-Type","text/plain"),r.send(JSON.stringify(a)),r.onreadystatechange=function(){4===r.readyState&&t&&t.callback&&t.callback({status:r.status})}}var t=window.plausible&&window.plausible.q||[];window.plausible=e;for(var a,i=0;i<t.length;i++)e.apply(this,t[i]);function n(){a=l.pathname,e("pageview")}window.addEventListener("hashchange",n),"prerender"===o.visibilityState?o.addEventListener("visibilitychange",function(){a||"visible"!==o.visibilityState||n()}):n();var u=1;function r(e){var t,a,i,n,r,l,o;function p(){n||(n=!0,window.location=i.href)}"auxclick"===e.type&&e.button!==u||(t=function(e){for(;e&&(void 0===e.tagName||!(t=e)||!t.tagName||"a"!==t.tagName.toLowerCase()||!e.href);)e=e.parentNode;var t;return e}(e.target),a=t&&t.href&&t.href.split("?")[0],(l=a)&&(o=l.split(".").pop(),g.some(function(e){return e===o}))&&(n=!(l={name:"File Download",props:{url:a}}),!function(e,t){if(!e.defaultPrevented)return t=!t.target||t.target.match(/^_(self|parent|top)$/i),e=!(e.ctrlKey||e.metaKey||e.shiftKey)&&"click"===e.type,t&&e}(a=e,i=t)?(r={props:l.props},plausible(l.name,r)):(r={props:l.props,callback:p},plausible(l.name,r),setTimeout(p,5e3),a.preventDefault())))}o.addEventListener("click",r),o.addEventListener("auxclick",r);var d=["pdf","xlsx","docx","txt","rtf","csv","exe","key","pps","ppt","pptx","7z","pkg","rar","gz","zip","avi","mov","mp4","mpeg","wmv","midi","mp3","wav","wma","dmg"],f=p.getAttribute("file-types"),w=p.getAttribute("add-file-types"),g=f&&f.split(",")||w&&w.split(",").concat(d)||d}();
```

### Core Architecture Module: `app/js/script.compat.exclusions.file-downloads.hash.local.js`
```
!function(){"use strict";var l=window.location,p=window.document,o=p.getElementById("plausible"),s=o.getAttribute("data-api")||(f=(f=o).src.split("/"),d=f[0],f=f[2],d+"//"+f+"/api/event");function c(e,t){e&&console.warn("Ignoring Event: "+e),t&&t.callback&&t.callback()}function e(e,t){try{if("true"===window.localStorage.plausible_ignore)return c("localStorage flag",t)}catch(e){}var a=o&&o.getAttribute("data-include"),i=o&&o.getAttribute("data-exclude");if("pageview"===e){a=!a||a.split(",").some(n),i=i&&i.split(",").some(n);if(!a||i)return c("exclusion rule",t)}function n(e){var t=l.pathname;return(t+=l.hash).match(new RegExp("^"+e.trim().replace(/\*\*/g,".*").replace(/([^\.])\*/g,"$1[^\\s/]*")+"/?$"))}var a={},r=(a.n=e,a.u=l.href,a.d=o.getAttribute("data-domain"),a.r=p.referrer||null,t&&t.meta&&(a.m=JSON.stringify(t.meta)),t&&t.props&&(a.p=t.props),a.h=1,new XMLHttpRequest);r.open("POST",s,!0),r.setRequestHeader("Content-Type","text/plain"),r.send(JSON.stringify(a)),r.onreadystatechange=function(){4===r.readyState&&t&&t.callback&&t.callback({status:r.status})}}var t=window.plausible&&window.plausible.q||[];window.plausible=e;for(var a,i=0;i<t.length;i++)e.apply(this,t[i]);function n(){a=l.pathname,e("pageview")}window.addEventListener("hashchange",n),"prerender"===p.visibilityState?p.addEventListener("visibilitychange",function(){a||"visible"!==p.visibilityState||n()}):n();var u=1;function r(e){var t,a,i,n,r,l,p;function o(){n||(n=!0,window.location=i.href)}"auxclick"===e.type&&e.button!==u||(t=function(e){for(;e&&(void 0===e.tagName||!(t=e)||!t.tagName||"a"!==t.tagName.toLowerCase()||!e.href);)e=e.parentNode;var t;return e}(e.target),a=t&&t.href&&t.href.split("?")[0],(l=a)&&(p=l.split(".").pop(),m.some(function(e){return e===p}))&&(n=!(l={name:"File Download",props:{url:a}}),!function(e,t){if(!e.defaultPrevented)return t=!t.target||t.target.match(/^_(self|parent|top)$/i),e=!(e.ctrlKey||e.metaKey||e.shiftKey)&&"click"===e.type,t&&e}(a=e,i=t)?(r={props:l.props},plausible(l.name,r)):(r={props:l.props,callback:o},plausible(l.name,r),setTimeout(o,5e3),a.preventDefault())))}p.addEventListener("click",r),p.addEventListener("auxclick",r);var d=["pdf","xlsx","docx","txt","rtf","csv","exe","key","pps","ppt","pptx","7z","pkg","rar","gz","zip","avi","mov","mp4","mpeg","wmv","midi","mp3","wav","wma","dmg"],f=o.getAttribute("file-types"),g=o.getAttribute("add-file-types"),m=f&&f.split(",")||g&&g.split(",").concat(d)||d}();
```

### Core Architecture Module: `app/js/script.compat.exclusions.file-downloads.hash.local.manual.js`
```
!function(){"use strict";var l=window.location,p=window.document,o=p.getElementById("plausible"),s=o.getAttribute("data-api")||(n=(n=o).src.split("/"),i=n[0],n=n[2],i+"//"+n+"/api/event");function c(e,t){e&&console.warn("Ignoring Event: "+e),t&&t.callback&&t.callback()}function e(e,t){try{if("true"===window.localStorage.plausible_ignore)return c("localStorage flag",t)}catch(e){}var a=o&&o.getAttribute("data-include"),r=o&&o.getAttribute("data-exclude");if("pageview"===e){a=!a||a.split(",").some(i),r=r&&r.split(",").some(i);if(!a||r)return c("exclusion rule",t)}function i(e){var t=l.pathname;return(t+=l.hash).match(new RegExp("^"+e.trim().replace(/\*\*/g,".*").replace(/([^\.])\*/g,"$1[^\\s/]*")+"/?$"))}var a={},n=(a.n=e,a.u=t&&t.u?t.u:l.href,a.d=o.getAttribute("data-domain"),a.r=p.referrer||null,t&&t.meta&&(a.m=JSON.stringify(t.meta)),t&&t.props&&(a.p=t.props),a.h=1,new XMLHttpRequest);n.open("POST",s,!0),n.setRequestHeader("Content-Type","text/plain"),n.send(JSON.stringify(a)),n.onreadystatechange=function(){4===n.readyState&&t&&t.callback&&t.callback({status:n.status})}}var t=window.plausible&&window.plausible.q||[];window.plausible=e;for(var a=0;a<t.length;a++)e.apply(this,t[a]);var u=1;function r(e){var t,a,r,i,n,l,p;function o(){i||(i=!0,window.location=r.href)}"auxclick"===e.type&&e.button!==u||(t=function(e){for(;e&&(void 0===e.tagName||!(t=e)||!t.tagName||"a"!==t.tagName.toLowerCase()||!e.href);)e=e.parentNode;var t;return e}(e.target),a=t&&t.href&&t.href.split("?")[0],(l=a)&&(p=l.split(".").pop(),f.some(function(e){return e===p}))&&(i=!(l={name:"File Download",props:{url:a}}),!function(e,t){if(!e.defaultPrevented)return t=!t.target||t.target.match(/^_(self|parent|top)$/i),e=!(e.ctrlKey||e.metaKey||e.shiftKey)&&"click"===e.type,t&&e}(a=e,r=t)?(n={props:l.props},plausible(l.name,n)):(n={props:l.props,callback:o},plausible(l.name,n),setTimeout(o,5e3),a.preventDefault())))}p.addEventListener("click",r),p.addEventListener("auxclick",r);var i=["pdf","xlsx","docx","txt","rtf","csv","exe","key","pps","ppt","pptx","7z","pkg","rar","gz","zip","avi","mov","mp4","mpeg","wmv","midi","mp3","wav","wma","dmg"],n=o.getAttribute("file-types"),d=o.getAttribute("add-file-types"),f=n&&n.split(",")||d&&d.split(",").concat(i)||i}();
```

### Core Architecture Module: `app/js/script.compat.exclusions.file-downloads.hash.local.manual.outbound-links.js`
```
!function(){"use strict";var l=window.location,o=window.document,p=o.getElementById("plausible"),s=p.getAttribute("data-api")||(d=(d=p).src.split("/"),n=d[0],d=d[2],n+"//"+d+"/api/event");function u(t,e){t&&console.warn("Ignoring Event: "+t),e&&e.callback&&e.callback()}function t(t,e){try{if("true"===window.localStorage.plausible_ignore)return u("localStorage flag",e)}catch(t){}var a=p&&p.getAttribute("data-include"),r=p&&p.getAttribute("data-exclude");if("pageview"===t){a=!a||a.split(",").some(n),r=r&&r.split(",").some(n);if(!a||r)return u("exclusion rule",e)}function n(t){var e=l.pathname;return(e+=l.hash).match(new RegExp("^"+t.trim().replace(/\*\*/g,".*").replace(/([^\.])\*/g,"$1[^\\s/]*")+"/?$"))}var a={},i=(a.n=t,a.u=e&&e.u?e.u:l.href,a.d=p.getAttribute("data-domain"),a.r=o.referrer||null,e&&e.meta&&(a.m=JSON.stringify(e.meta)),e&&e.props&&(a.p=e.props),a.h=1,new XMLHttpRequest);i.open("POST",s,!0),i.setRequestHeader("Content-Type","text/plain"),i.send(JSON.stringify(a)),i.onreadystatechange=function(){4===i.readyState&&e&&e.callback&&e.callback({status:i.status})}}var e=window.plausible&&window.plausible.q||[];window.plausible=t;for(var a=0;a<e.length;a++)t.apply(this,e[a]);var i=1;function r(t){var e,a,r,n;if("auxclick"!==t.type||t.button===i)return e=function(t){for(;t&&(void 0===t.tagName||!(e=t)||!e.tagName||"a"!==e.tagName.toLowerCase()||!t.href);)t=t.parentNode;var e;return t}(t.target),a=e&&e.href&&e.href.split("?")[0],(r=e)&&r.href&&r.host&&r.host!==l.host?c(t,e,{name:"Outbound Link: Click",props:{url:e.href}}):(r=a)&&(n=r.split(".").pop(),g.some(function(t){return t===n}))?c(t,e,{name:"File Download",props:{url:a}}):void 0}function c(t,e,a){var r,n=!1;function i(){n||(n=!0,window.location=e.href)}!function(t,e){if(!t.defaultPrevented)return e=!e.target||e.target.match(/^_(self|parent|top)$/i),t=!(t.ctrlKey||t.metaKey||t.shiftKey)&&"click"===t.type,e&&t}(t,e)?(r={props:a.props},plausible(a.name,r)):(r={props:a.props,callback:i},plausible(a.name,r),setTimeout(i,5e3),t.preventDefault())}o.addEventListener("click",r),o.addEventListener("auxclick",r);var n=["pdf","xlsx","docx","txt","rtf","csv","exe","key","pps","ppt","pptx","7z","pkg","rar","gz","zip","avi","mov","mp4","mpeg","wmv","midi","mp3","wav","wma","dmg"],d=p.getAttribute("file-types"),f=p.getAttribute("add-file-types"),g=d&&d.split(",")||f&&f.split(",").concat(n)||n}();
```

### Core Architecture Module: `app/js/script.compat.exclusions.file-downloads.hash.local.manual.outbound-links.pageview-props.js`
```
!function(){"use strict";var l=window.location,p=window.document,u=p.getElementById("plausible"),s=u.getAttribute("data-api")||(f=(f=u).src.split("/"),n=f[0],f=f[2],n+"//"+f+"/api/event");function c(t,e){t&&console.warn("Ignoring Event: "+t),e&&e.callback&&e.callback()}function t(t,e){try{if("true"===window.localStorage.plausible_ignore)return c("localStorage flag",e)}catch(t){}var a=u&&u.getAttribute("data-include"),r=u&&u.getAttribute("data-exclude");if("pageview"===t){a=!a||a.split(",").some(n),r=r&&r.split(",").some(n);if(!a||r)return c("exclusion rule",e)}function n(t){var e=l.pathname;return(e+=l.hash).match(new RegExp("^"+t.trim().replace(/\*\*/g,".*").replace(/([^\.])\*/g,"$1[^\\s/]*")+"/?$"))}var a={},r=(a.n=t,a.u=e&&e.u?e.u:l.href,a.d=u.getAttribute("data-domain"),a.r=p.referrer||null,e&&e.meta&&(a.m=JSON.stringify(e.meta)),e&&e.props&&(a.p=e.props),u.getAttributeNames().filter(function(t){return"event-"===t.substring(0,6)})),i=a.p||{},o=(r.forEach(function(t){var e=t.replace("event-",""),t=u.getAttribute(t);i[e]=i[e]||t}),a.p=i,a.h=1,new XMLHttpRequest);o.open("POST",s,!0),o.setRequestHeader("Content-Type","text/plain"),o.send(JSON.stringify(a)),o.onreadystatechange=function(){4===o.readyState&&e&&e.callback&&e.callback({status:o.status})}}var e=window.plausible&&window.plausible.q||[];window.plausible=t;for(var a=0;a<e.length;a++)t.apply(this,e[a]);var i=1;function r(t){var e,a,r,n;if("auxclick"!==t.type||t.button===i)return e=function(t){for(;t&&(void 0===t.tagName||!(e=t)||!e.tagName||"a"!==e.tagName.toLowerCase()||!t.href);)t=t.parentNode;var e;return t}(t.target),a=e&&e.href&&e.href.split("?")[0],(r=e)&&r.href&&r.host&&r.host!==l.host?o(t,e,{name:"Outbound Link: Click",props:{url:e.href}}):(r=a)&&(n=r.split(".").pop(),g.some(function(t){return t===n}))?o(t,e,{name:"File Download",props:{url:a}}):void 0}function o(t,e,a){var r,n=!1;function i(){n||(n=!0,window.location=e.href)}!function(t,e){if(!t.defaultPrevented)return e=!e.target||e.target.match(/^_(self|parent|top)$/i),t=!(t.ctrlKey||t.metaKey||t.shiftKey)&&"click"===t.type,e&&t}(t,e)?(r={props:a.props},plausible(a.name,r)):(r={props:a.props,callback:i},plausible(a.name,r),setTimeout(i,5e3),t.preventDefault())}p.addEventListener("click",r),p.addEventListener("auxclick",r);var n=["pdf","xlsx","docx","txt","rtf","csv","exe","key","pps","ppt","pptx","7z","pkg","rar","gz","zip","avi","mov","mp4","mpeg","wmv","midi","mp3","wav","wma","dmg"],f=u.getAttribute("file-types"),d=u.getAttribute("add-file-types"),g=f&&f.split(",")||d&&d.split(",").concat(n)||n}();
```

### Core Architecture Module: `app/js/script.compat.exclusions.file-downloads.hash.local.manual.outbound-links.pageview-props.revenue.js`
```
!function(){"use strict";var l=window.location,p=window.document,u=p.getElementById("plausible"),s=u.getAttribute("data-api")||(f=(f=u).src.split("/"),n=f[0],f=f[2],n+"//"+f+"/api/event");function c(e,t){e&&console.warn("Ignoring Event: "+e),t&&t.callback&&t.callback()}function e(e,t){try{if("true"===window.localStorage.plausible_ignore)return c("localStorage flag",t)}catch(e){}var a=u&&u.getAttribute("data-include"),r=u&&u.getAttribute("data-exclude");if("pageview"===e){a=!a||a.split(",").some(n),r=r&&r.split(",").some(n);if(!a||r)return c("exclusion rule",t)}function n(e){var t=l.pathname;return(t+=l.hash).match(new RegExp("^"+e.trim().replace(/\*\*/g,".*").replace(/([^\.])\*/g,"$1[^\\s/]*")+"/?$"))}var a={},r=(a.n=e,a.u=t&&t.u?t.u:l.href,a.d=u.getAttribute("data-domain"),a.r=p.referrer||null,t&&t.meta&&(a.m=JSON.stringify(t.meta)),t&&t.props&&(a.p=t.props),t&&t.revenue&&(a.$=t.revenue),u.getAttributeNames().filter(function(e){return"event-"===e.substring(0,6)})),i=a.p||{},o=(r.forEach(function(e){var t=e.replace("event-",""),e=u.getAttribute(e);i[t]=i[t]||e}),a.p=i,a.h=1,new XMLHttpRequest);o.open("POST",s,!0),o.setRequestHeader("Content-Type","text/plain"),o.send(JSON.stringify(a)),o.onreadystatechange=function(){4===o.readyState&&t&&t.callback&&t.callback({status:o.status})}}var t=window.plausible&&window.plausible.q||[];window.plausible=e;for(var a=0;a<t.length;a++)e.apply(this,t[a]);var i=1;function r(e){var t,a,r,n;if("auxclick"!==e.type||e.button===i)return t=function(e){for(;e&&(void 0===e.tagName||!(t=e)||!t.tagName||"a"!==t.tagName.toLowerCase()||!e.href);)e=e.parentNode;var t;return e}(e.target),a=t&&t.href&&t.href.split("?")[0],(r=t)&&r.href&&r.host&&r.host!==l.host?o(e,t,{name:"Outbound Link: Click",props:{url:t.href}}):(r=a)&&(n=r.split(".").pop(),g.some(function(e){return e===n}))?o(e,t,{name:"File Download",props:{url:a}}):void 0}function o(e,t,a){var r,n=!1;function i(){n||(n=!0,window.location=t.href)}!function(e,t){if(!e.defaultPrevented)return t=!t.target||t.target.match(/^_(self|parent|top)$/i),e=!(e.ctrlKey||e.metaKey||e.shiftKey)&&"click"===e.type,t&&e}(e,t)?((r={props:a.props}).revenue=a.revenue,plausible(a.name,r)):((r={props:a.props,callback:i}).revenue=a.revenue,plausible(a.name,r),setTimeout(i,5e3),e.preventDefault())}p.addEventListener("click",r),p.addEventListener("auxclick",r);var n=["pdf","xlsx","docx","txt","rtf","csv","exe","key","pps","ppt","pptx","7z","pkg","rar","gz","zip","avi","mov","mp4","mpeg","wmv","midi","mp3","wav","wma","dmg"],f=u.getAttribute("file-types"),d=u.getAttribute("add-file-types"),g=f&&f.split(",")||d&&d.split(",").concat(n)||n}();
```

### Core Architecture Module: `app/js/script.compat.exclusions.file-downloads.hash.local.manual.outbound-links.pageview-props.revenue.tagged-events.js`
```
!function(){"use strict";var o=window.location,p=window.document,l=p.getElementById("plausible"),s=l.getAttribute("data-api")||(i=(i=l).src.split("/"),a=i[0],i=i[2],a+"//"+i+"/api/event");function c(e,t){e&&console.warn("Ignoring Event: "+e),t&&t.callback&&t.callback()}function e(e,t){try{if("true"===window.localStorage.plausible_ignore)return c("localStorage flag",t)}catch(e){}var r=l&&l.getAttribute("data-include"),n=l&&l.getAttribute("data-exclude");if("pageview"===e){r=!r||r.split(",").some(a),n=n&&n.split(",").some(a);if(!r||n)return c("exclusion rule",t)}function a(e){var t=o.pathname;return(t+=o.hash).match(new RegExp("^"+e.trim().replace(/\*\*/g,".*").replace(/([^\.])\*/g,"$1[^\\s/]*")+"/?$"))}var r={},n=(r.n=e,r.u=t&&t.u?t.u:o.href,r.d=l.getAttribute("data-domain"),r.r=p.referrer||null,t&&t.meta&&(r.m=JSON.stringify(t.meta)),t&&t.props&&(r.p=t.props),t&&t.revenue&&(r.$=t.revenue),l.getAttributeNames().filter(function(e){return"event-"===e.substring(0,6)})),i=r.p||{},u=(n.forEach(function(e){var t=e.replace("event-",""),e=l.getAttribute(e);i[t]=i[t]||e}),r.p=i,r.h=1,new XMLHttpRequest);u.open("POST",s,!0),u.setRequestHeader("Content-Type","text/plain"),u.send(JSON.stringify(r)),u.onreadystatechange=function(){4===u.readyState&&t&&t.callback&&t.callback({status:u.status})}}var t=window.plausible&&window.plausible.q||[];window.plausible=e;for(var r=0;r<t.length;r++)e.apply(this,t[r]);function f(e){return e&&e.tagName&&"a"===e.tagName.toLowerCase()}var v=1;function n(e){if("auxclick"!==e.type||e.button===v){var t,r,n=function(e){for(;e&&(void 0===e.tagName||!f(e)||!e.href);)e=e.parentNode;return e}(e.target),a=n&&n.href&&n.href.split("?")[0];if(!function e(t,r){if(!t||b<r)return!1;if(w(t))return!0;return e(t.parentNode,r+1)}(n,0))return(t=n)&&t.href&&t.host&&t.host!==o.host?m(e,n,{name:"Outbound Link: Click",props:{url:n.href}}):(t=a)&&(r=t.split(".").pop(),d.some(function(e){return e===r}))?m(e,n,{name:"File Download",props:{url:a}}):void 0}}function m(e,t,r){var n,a=!1;function i(){a||(a=!0,window.location=t.href)}!function(e,t){if(!e.defaultPrevented)return t=!t.target||t.target.match(/^_(self|parent|top)$/i),e=!(e.ctrlKey||e.metaKey||e.shiftKey)&&"click"===e.type,t&&e}(e,t)?((n={props:r.props}).revenue=r.revenue,plausible(r.name,n)):((n={props:r.props,callback:i}).revenue=r.revenue,plausible(r.name,n),setTimeout(i,5e3),e.preventDefault())}p.addEventListener("click",n),p.addEventListener("auxclick",n);var a=["pdf","xlsx","docx","txt","rtf","csv","exe","key","pps","ppt","pptx","7z","pkg","rar","gz","zip","avi","mov","mp4","mpeg","wmv","midi","mp3","wav","wma","dmg"],i=l.getAttribute("file-types"),u=l.getAttribute("add-file-types"),d=i&&i.split(",")||u&&u.split(",").concat(a)||a;function g(e){var e=w(e)?e:e&&e.parentNode,t={name:null,props:{},revenue:{}},r=e&&e.classList;if(r)for(var n=0;n<r.length;n++){var a,i,u=r.item(n),o=u.match(/plausible-event-(.+)(=|--)(.+)/),o=(o&&(a=o[1],i=o[3].replace(/\+/g," "),"name"==a.toLowerCase()?t.name=i:t.props[a]=i),u.match(/plausible-revenue-(.+)(=|--)(.+)/));o&&(a=o[1],i=o[3],t.revenue[a]=i)}return t}var b=3;function h(e){if("auxclick"!==e.type||e.button===v){for(var t,r,n,a,i=e.target,u=0;u<=b&&i;u++){if((n=i)&&n.tagName&&"form"===n.tagName.toLowerCase())return;f(i)&&(t=i),w(i)&&(r=i),i=i.parentNode}r&&(a=g(r),t?(a.props.url=t.href,m(e,t,a)):((e={}).props=a.props,e.revenue=a.revenue,plausible(a.name,e)))}}function w(e){var t=e&&e.classList;if(t)for(var r=0;r<t.length;r++)if(t.item(r).match(/plausible-event-name(=|--)(.+)/))return!0;return!1}p.addEventListener("submit",function(e){var t,r=e.target,n=g(r);function a(){t||(t=!0,r.submit())}n.name&&(e.preventDefault(),t=!1,setTimeout(a,5e3),(e={props:n.props,callback:a}).revenue=n.revenue,plausible(n.name,e))}),p.addEventListener("click",h),p.addEventListener("auxclick",h)}();
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #92** (2025-11-10): **feat: add dark mode toggle and project labels**
  *Symptoms*: This commit addresses multiple UX improvements:  1. Dark Mode Toggle    - Add dark/light mode toggle button in header    - Persist theme preference in localStorage    - Auto-detect system dark mode preference    - Toggle icons (sun/moon) with smooth transitions  2. Project Labels    - Add optional label field to Site model (protobuf)    - Display custom labels instead of domains on homepage    - Show domain as subtitle when label differs    - Add settings UI to edit site display names    - Backend endpoint to save labels    - Fallback to domain when no label is set  3. Code Quality    - Rebuild CSS and JavaScript bundles    - Update Go protobuf generated code  Note: The home page visitor count issue (showing all-time instead of 24h) was already fixed in commit b65181d. Users need to rebuild/restart the server to see the fix.  Files Changed: - assets/js/app.js: Dark mode logic - internal/web/templates/layout/header.html: Dark mode toggle button - proto/vince/v1/config.proto: Add label field - gen/go/vince/v1/config.pb.go: Generated protobuf code - internal/web/site.go: Label handling in backend - internal/cmd/run.go: Route for updating labels - internal/web/templates/site/index.html: Display labels - internal/web/templates/site/settings.html: Label edit form
  **Post-Mortem & Fix Analysis**:
  > AI generated work is not welcome here.
  > > AI generated work is not welcome here.  Why?

- **Issue #88** (2025-09-15): **New**
  *Symptoms*: 

- **Issue #86** (2025-09-01): **fix: custom range query**
  *Symptoms*: Found another issue with custom range querying. The URL params are `from` and `to` but the functions in `query.go` were expecting a `date` param.

- **Issue #85** (2025-08-31): **fix: stats**
  *Symptoms*: This PR addresses several issues with how statistics were computed and displayed.  - The `endOfYear` function in `period.go` had a typo - The visitors count on the homepage was the all-time count instead of the last 24 hours - The database was missing a view for `encoding.Month`, which means most charts with a month resolution don't work (and will remain broken for existing data). For future data, this should be fixed. - To have a better user experience, the "weeks" granularity is now the default for periods like "last 12 months" or "year to date", so that the chart can display something even if the monthly view is missing. - The "All time" query was extremely inefficient because it started at year 0001. A better starting point (year 2000) was chosen, which effectively fixes this time range.  Additionally, I had to update the `cockroachdb/swiss` dependency for the project to build.  Closes https://github.com/vinceanalytics/vince/issues/78 (probably)  Maybe we can consider changing the `12mo` and `year` intervals back to "Month" in a year from now, when it won't affect existing installs anymore. Alternatively, we could imagine to back-fill the database I guess? I'm not willing to implement it but I guess it would also solve the missing data problem.
  **Post-Mortem & Fix Analysis**:
  > @gernest I restored the month interval wherever it was changed.

- **Issue #83** (2025-07-21): **Fails in GCP**
  *Symptoms*: ``` ❯ vince serve 2025/07/20 10:55:35 [JOB 1] WAL 000007 stopped reading at offset: (vince-data/ops/000007.log: 102); replayed 1 keys in 1 batches 2025/07/20 10:55:35 [JOB 1] WAL 000002 stopped reading at offset: (data/000002.log: 0); replayed 0 keys in 0 batches 2025/07/20 10:55:35 INFO loading translation data 2025/07/20 10:55:35 INFO complete loading translation elapsed=87.636µs keys=0 2025/07/20 10:55:35 INFO starting event processing loop 2025/07/20 10:55:35 INFO starting server addr=:8080 2025/07/20 10:55:35 INFO exiting event processing loop 2025/07/20 10:55:35 INFO Shutting down ```  Any ideas?
  **Post-Mortem & Fix Analysis**:
  > does the binary have permission to bind on port `:8080` ?
  > Yes, that was the reason, that port was taken. But it failed without any helpful errors! It worked now and I really love it!

- **Issue #80** (2025-07-07): **Possible reasons we keep getting 202 / x-plausible-dropped: 1**
  *Symptoms*: Hi team, Geofrey: Vince looks fantastic and exactly what we'd need - lightweight, great choice of underlying stack, and straightforward API. Thanks for putting in all the hard work!  Unfortunately ... we for the love of it can't get it to work? Dedicated Hetzner server, running it via `systemd` as  `ExecStart=vince serve --listen :443 --data /opt/foo/analyticsdata --autoTLS --acmeEmail accounts@foo.place --acmeDomain vince.foo.cloud --url https://vince.foo.cloud --domains www.foo.cloud --adminName foo --adminPassword ...`  Backend works, domain show as such, requests to API go through (and are even properly validate, eg triggering `pageview` to `https://www.foo.cloud` complain about missing path, but we're still stuck with a dreaded 'Waiting for first pageview on www.foo.cloud`. Requests are responded to with a body of OK, but status 202 and x-plausible-dropped: 1, same as if we trigger with `plausible('pageview', {u: 'https://www.somedifferentdomain.cloud/bar/'});`  What we tried so far:  - Ton of different combinations of scripts and their placement (`head`, outside, bottom etc). - Different domains even (with and without `www`, even tried configuring with `https://www...`) - Running it directly without systemd.  Absolutely no luck - any idea what it could be? Probably something extremely obvious, or very sneaky...  Any pointers or hints much appreciated!
  **Post-Mortem & Fix Analysis**:
  > And it was actually something obvious, when we tried different domain variations, the deploy script didn't reload `systemd` properly and we actually didn't test the correct settings which for us are:  - Starting with `--domains foo.cloud` (**without** the www). - Using `data-domain="www.foo.cloud"` in the `script` tag. - Sending pageviews/events with `https://www.foo.cloud/...` in js.  Everything works extremely well now, really recommend and appreciate!

- **Issue #79** (2025-07-10): **Large PebbleDB files in path 'internal/location/data' - was this intended to be committed?**
  *Symptoms*: Hi team,  I noticed that the PebbleDB files located in the internal/location/data directory are quite large.  Just wanted to check if these files were intentionally committed to the repository? Large binary files like PebbleDB data can often bloat the repo size and slow down cloning/pushing operations.  If they're not needed in the repo (e.g., they're generated runtime data or local cache), it might be worth adding them to .gitignore instead. Let me know your thoughts!  Thanks
  **Post-Mortem & Fix Analysis**:
  > They are intended.   We use free geoip database which does not contain country and region information. To derive country and region data we need to use geoname  database  forllwhich is massive. and not indexed.  So we fully index data for all countries and regions into pebble. Then export the resulting sstables.  Initially I used git lfs for the sstables, but when the project started to get traction I maxed out the allocated budget. T o work around this I had to improvise and commit the files in chunked state .  In short, I can't afford git lfs,  and we need the index to compute correct country and region information from geoip.

- **Issue #78** (2025-08-31): **Stats are wrong**
  *Symptoms*: There are some inconsistencies with the displayed number of visitors which makes it impossible to trust the data.  See here on the homepage (224 visitors in 24h)  ![Image](https://github.com/user-attachments/assets/4b52a3f4-dbd0-4e05-9d62-9045339afb32)  Default view (month to date: 58 unique visitors, 66 total visits)  ![Image](https://github.com/user-attachments/assets/1adf2dc4-53f1-449e-93e6-7267558155c7)  Custom range (1 May - 24 June: 2 unique visitors, 2 total visits)  ![Image](https://github.com/user-attachments/assets/f35e300e-5d2e-465b-8861-af3ff30f9425)  Even the demo instance shows the same behavior:  ![Image](https://github.com/user-attachments/assets/898c16a9-9002-4589-91ff-bf6367451db4)  Something is seriously broken, and this is not isolated to this instance. I have the same issue on a separate instance for another website.
  **Post-Mortem & Fix Analysis**:
  > Hey @gernest , is there any information about the status of this project? Is it still maintained?
  > > Hey [@gernest](https://github.com/gernest) , is there any information about the status of this project? Is it still maintained?  @beeb I use vince in production for my use case.   I'm pretty stretched at the moment and only prioritise issues directly impacting my use case.   The project is free and open source, all contributions are welcome. You can work on the  issue and I will gladly help review your PR.   
  > Are you affected by the bug I described? 

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

### Incident Patch 1: `c7b11e2d` (2025-09-01)
**Commit Message**: fix: custom range query (#86)

**File**: `internal/web/query/query.go` (modified, +12/-1)
```diff
@@ -25,7 +25,18 @@ func New(u url.Values) *Query {
 	var fs Filters
 	json.Unmarshal([]byte(u.Get("filters")), &fs)
 
-	period := period(u.Get("period"), u.Get("date"))
+	// normalize date range format
+	var dateParam string
+	if u.Get("period") == "custom" {
+		from := u.Get("from")
+		to := u.Get("to")
+		if from != "" && to != "" {
+			dateParam = from + "," + to
+		}
+	} else {
+		dateParam = u.Get("date")
+	}
+	period := period(u.Get("period"), dateParam)
 	if i := u.Get("interval"); i != "" {
 		switch i {
 		case "minute":
```

---

### Incident Patch 2: `b65181dc` (2025-08-31)
**Commit Message**: fix: stats (#85)

* fix: endOfYear helper

* chore: add multi-stage dockerfile for testing

* chore: update dependency

* fix: visitors count in homepage

* fix: store month timestamp view

* fix: set default chart granularity to "weeks" to avoid empty chart

* fix: better period start for "all" filter

* chore: delete test dockerfile

* revert: "fix: set default chart granularity to "weeks" to avoid empty chart"

This reverts commit 78b786a6a4f04b1f5fe6e6b12af6bbeaf464bc7f.

* revert: restore month interval for 6mo, 12mo and year periods

**File**: `go.mod` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ go 1.23.2
 require (
 	filippo.io/age v1.2.0
 	github.com/cockroachdb/pebble v0.0.0-20241105214940-2da617a0a886
-	github.com/cockroachdb/swiss v0.0.0-20240612210725-f4de07ae6964
+	github.com/cockroachdb/swiss v0.0.0-20250624142022-d6e517c1d961
 	github.com/dlclark/regexp2 v1.11.4
 	github.com/gernest/roaring v0.23.0
 	github.com/google/flatbuffers v24.3.25+incompatible
```

**File**: `go.sum` (modified, +2/-0)
```diff
@@ -78,6 +78,8 @@ github.com/cockroachdb/redact v1.1.5 h1:u1PMllDkdFfPWaNGMyLD1+so+aq3uUItthCFqzwP
 github.com/cockroachdb/redact v1.1.5/go.mod h1:BVNblN9mBWFyMyqK1k3AAiSxhvhfK2oOZZ2lK+dpvRg=
 github.com/cockroachdb/swiss v0.0.0-20240612210725-f4de07ae6964 h1:Ew0znI2JatzKy52N1iS5muUsHkf2UJuhocH7uFW7jjs=
 github.com/cockroachdb/swiss v0.0.0-20240612210725-f4de07ae6964/go.mod h1:yBRu/cnL4ks9bgy4vAASdjIW+/xMlFwuHKqtmh3GZQg=
+github.com/cockroachdb/swiss v0.0.0-20250624142022-d6e517c1d961 h1:Nua446ru3juLHLZd4AwKNzClZgL1co3pUPGv3o8FlcA=
+github.com/cockroachdb/swiss v0.0.0-20250624142022-d6e517c1d961/go.mod h1:yBRu/cnL4ks9bgy4vAASdjIW+/xMlFwuHKqtmh3GZQg=
 github.com/cockroachdb/tokenbucket v0.0.0-20230807174530-cc333fc44b06 h1:zuQyyAKVxetITBuuhv3BI9cMrmStnpT18zmgmTxunpo=
 github.com/cockroachdb/tokenbucket v0.0.0-20230807174530-cc333fc44b06/go.mod h1:7nc4anLGjupUW/PeY5qiNYsdNXj7zopG+eqsS7To5IQ=
 github.com/creack/pty v1.1.9/go.mod h1:oKZEueFk5CKHvIhNR5MUki03XCEU+Q6VDXinZuGJ33E=
```

**File**: `internal/api/visitors/visitors.go` (modified, +2/-1)
```diff
@@ -18,6 +18,7 @@ func Current(ctx context.Context, ts *timeseries.Timeseries, domain string) (vis
 
 func Visitors(ctx context.Context, ts *timeseries.Timeseries, domain string) (visitors uint64, err error) {
 	end := xtime.Now()
-	visitors = ts.Visitors(time.Time{}, end, encoding.Global, domain)
+	start := end.Add(-24 * time.Hour)
+	visitors = ts.Visitors(start, end, encoding.Hour, domain)
 	return
 }
```

**File**: `internal/timeseries/timeseries_batch.go` (modified, +2/-1)
```diff
@@ -67,8 +67,9 @@ func (b *batch) setTs(timestamp int64) {
 	ts := xtime.UnixMilli(timestamp)
 	b.views[encoding.Minute] = uint64(compute.Minute(ts).UnixMilli())
 	b.views[encoding.Hour] = uint64(compute.Hour(ts).UnixMilli())
-	b.views[encoding.Week] = uint64(compute.Week(ts).UnixMilli())
 	b.views[encoding.Day] = uint64(compute.Date(ts).UnixMilli())
+	b.views[encoding.Week] = uint64(compute.Week(ts).UnixMilli())
+	b.views[encoding.Month] = uint64(compute.Month(ts).UnixMilli())
 }
 
 func (b *batch) setDomain(m *models.Model) {
```

**File**: `internal/web/query/period.go` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ func period(str, date string) Period {
 		first := beginOfYear(last)
 		return Period{Start: first, End: last, Interval: Month}
 	case "all":
-		return Period{End: last, Interval: Date}
+		return Period{Start: time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC), End: last, Interval: Date}
 	default:
 		base.Interval = Hour
 		return Period{Start: beginOfDay(base.Start), End: last, Interval: Hour}
@@ -92,5 +92,5 @@ func endOfMonth(ts time.Time) time.Time {
 }
 
 func endOfYear(ts time.Time) time.Time {
-	return beginOfMonth(ts).AddDate(1, 0, 0).Add(-time.Nanosecond)
+	return beginOfYear(ts).AddDate(1, 0, 0).Add(-time.Nanosecond)
 }
```

---

### Incident Patch 3: `24ca92b0` (2025-01-25)
**Commit Message**: fix: reloading dashboard rendering 404

**File**: `internal/cmd/run.go` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ func run(ctx context.Context, c *cli.Command) error {
 		plug.Browser().Then(web.Home),
 	))
 
-	mux.HandleFunc("GET /{domain}", db.Wrap("query.Stats")(
+	mux.Handle("GET /{domain}/{$}", db.Wrap("query.Stats")(
 		plug.Browser().
 			With(web.RequireSiteAccess).
 			Then(web.Stats),
```

---

### Incident Patch 4: `f37f3a42` (2025-01-22)
**Commit Message**: Merge pull request #41 from ldidry/fix-domain-settings-link

🩹 — Fix domain settings link in site-switcher

**File**: `assets/js/dashboard/site-switcher.js` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ export default class SiteSwitcher extends React.Component {
             <a
               href={`/${encodeURIComponent(
                 this.props.site.domain
-              )}/settings/general`}
+              )}/settings`}
               className="group flex items-center px-4 py-2 md:text-sm leading-5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-900 focus:text-gray-900 dark:focus:text-gray-100"
               role="menuitem"
             >
```

---

### Incident Patch 5: `628fd3ca` (2025-01-22)
**Commit Message**: 🩹 — Fix domain settings link in site-switcher

**File**: `assets/js/dashboard/site-switcher.js` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ export default class SiteSwitcher extends React.Component {
             <a
               href={`/${encodeURIComponent(
                 this.props.site.domain
-              )}/settings/general`}
+              )}/settings`}
               className="group flex items-center px-4 py-2 md:text-sm leading-5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-gray-100 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-900 focus:text-gray-900 dark:focus:text-gray-100"
               role="menuitem"
             >
```

---

### Incident Patch 6: `31d81658` (2025-01-18)
**Commit Message**: fix(k8s): remove wrong label in secret template

**File**: `k8s/templates/secret.yaml` (modified, +2/-3)
```diff
@@ -4,8 +4,7 @@ kind: Secret
 metadata:
   name: {{ include "vince.fullname" . }}
   labels:
-    app: plausible
-  {{- include "vince.labels" . | nindent 4 }}
+    {{- include "vince.labels" . | nindent 4 }}
 type: Opaque
 data:
   VINCE_ADMIN_NAME: {{ .Values.secret.adminName | toString | b64enc }}
@@ -14,4 +13,4 @@ data:
   VINCE_ACME_EMAIL: {{ .Values.acme.email | toString | b64enc }}
   VINCE_ACME_DOMAIN: {{ .Values.acme.domain | toString | b64enc }}
   {{- end }}
-{{- end }}
\ No newline at end of file
+{{- end }}
```

---

### Incident Patch 7: `89efbde4` (2025-01-16)
**Commit Message**: Fix typo in run.go

**File**: `internal/cmd/run.go` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ var serve = &cli.Command{
 	Flags: []cli.Flag{
 		&cli.StringFlag{
 			Name:        "listen",
-			Usage:       "host:port to dind the servser",
+			Usage:       "host:port to bind the server",
 			Value:       ":8080",
 			Sources:     cli.EnvVars("VINCE_LISTEN"),
 			Destination: &oracle.Listen,
```

---

### Incident Patch 8: `8b9b9c71` (2025-01-01)
**Commit Message**: fix links on the dashboard

**File**: `internal/web/templates/stats/stats.html` (modified, +2/-2)
```diff
@@ -39,15 +39,15 @@ <h2 class="text-3xl font-extrabold tracking-tight text-gray-900 leading-9 sm:tex
         <div class="flex mt-8 lg:flex-shrink-0 lg:mt-0">
           <div class="inline-flex shadow rounded-md">
             <a
-              href="https://www.vinceanalytics.com/guides/deployment/local/"
+              href="https://www.vinceanalytics.com/blog/deploy-local/"
               class="inline-flex items-center justify-center px-5 py-3 text-base font-medium  bg-rose-300 border border-transparent leading-6 rounded-md hover:bg-rose-400 focus:outline-none focus:ring transition duration-150 ease-in-out"
             >
               Get started
             </a>
           </div>
           <div class="inline-flex ml-3 shadow rounded-md">
             <a
-              href="https://vinceanalytics.com"
+              href="https://www.vinceanalytics.com/categories/guides/"
               class="inline-flex items-center justify-center px-5 py-3 text-base font-medium text-rose-600 bg-white border border-transparent leading-6 rounded-md   hover:text-rose-500  focus:outline-none focus:ring transition duration-150 ease-in-out"
             >
               Learn more
```

---

### Incident Patch 9: `938f081f` (2024-12-06)
**Commit Message**: fix admin account creation

We had moved to shard per database api but admin command assummed we were
still using a single database for all shards.

This commit uses same api we use to start serve command to gain acces to
ops database on which we crate the new admin.

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 dev:
 	go build -o bin/vince
-	./bin/vince serve  --adminName acme --adminPassword 1234 --domains vinceanalytics.com --profile
+	./bin/vince serve  --adminName yolo --adminPassword 1234 --domains vinceanalytics.com --profile
 
 docker:
 	docker run --rm  -p 8080:8080 -v ./vince-data:/vince-data ghcr.io/vinceanalytics/vince:v1.7.1 serve  --adminName acme --adminPassword 1234 --domains vinceanalytics.com --profile
```

**File**: `gen/go/vince/v1/config.pb.go` (modified, +85/-85)
```diff
@@ -1,6 +1,6 @@
 // Code generated by protoc-gen-go. DO NOT EDIT.
 // versions:
-// 	protoc-gen-go v1.34.2
+// 	protoc-gen-go v1.35.2
 // 	protoc        (unknown)
 // source: vince/v1/config.proto
 
@@ -35,11 +35,9 @@ type Site struct {
 
 func (x *Site) Reset() {
 	*x = Site{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_config_proto_msgTypes[0]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_config_proto_msgTypes[0]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *Site) String() string {
@@ -50,7 +48,7 @@ func (*Site) ProtoMessage() {}
 
 func (x *Site) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_config_proto_msgTypes[0]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -118,11 +116,9 @@ type Goal struct {
 
 func (x *Goal) Reset() {
 	*x = Goal{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_config_proto_msgTypes[1]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_config_proto_msgTypes[1]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *Goal) String() string {
@@ -133,7 +129,7 @@ func (*Goal) ProtoMessage() {}
 
 func (x *Goal) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_config_proto_msgTypes[1]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -174,11 +170,9 @@ type Share struct {
 
 func (x *Share) Reset() {
 	*x = Share{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_config_proto_msgTypes[2]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_config_proto_msgTypes[2]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *Share) String() string {
@@ -189,7 +183,7 @@ func (*Share) ProtoMessage() {}
 
 func (x *Share) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_config_proto_msgTypes[2]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -236,11 +230,9 @@ type System struct {
 
 func (x *System) Reset() {
 	*x = System{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_config_proto_msgTypes[3]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_config_proto_msgTypes[3]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *System) String() string {
@@ -251,7 +243,7 @@ func (*System) ProtoMessage() {}
 
 func (x *System) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_config_proto_msgTypes[3]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -280,6 +272,59 @@ func (x *System) GetEmail() string {
 	return ""
 }
 
+type Admin struct {
+	state         protoimpl.MessageState
+	sizeCache     protoimpl.SizeCache
+	unknownFields protoimpl.UnknownFields
+
+	Name           string `protobuf:"bytes,1,opt,name=name,proto3" json:"name,omitempty"`
+	HashedPassword []byte `protobuf:"bytes,2,opt,name=hashed_password,json=hashedPassword,proto3" json:"hashed_password,omitempty"`
+}
+
+func (x *Admin) Reset() {
+	*x = Admin{}
+	mi := &file_vince_v1_config_proto_msgTypes[4]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
+}
+
+func (x *Admin) String() string {
+	return protoimpl.X.MessageStringOf(x)
+}
+
+func (*Admin) ProtoMessage() {}
+
+func (x *Admin) ProtoReflect(
```

**File**: `gen/go/vince/v1/license.pb.go` (removed, +0/-157)
```diff
@@ -1,157 +0,0 @@
-// Code generated by protoc-gen-go. DO NOT EDIT.
-// versions:
-// 	protoc-gen-go v1.34.2
-// 	protoc        (unknown)
-// source: vince/v1/license.proto
-
-package v1
-
-import (
-	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
-	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
-	reflect "reflect"
-	sync "sync"
-)
-
-const (
-	// Verify that this generated code is sufficiently up-to-date.
-	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
-	// Verify that runtime/protoimpl is sufficiently up-to-date.
-	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
-)
-
-type License struct {
-	state         protoimpl.MessageState
-	sizeCache     protoimpl.SizeCache
-	unknownFields protoimpl.UnknownFields
-
-	Expiry uint64 `protobuf:"varint,4,opt,name=expiry,proto3" json:"expiry,omitempty"`
-	Email  string `protobuf:"bytes,5,opt,name=email,proto3" json:"email,omitempty"`
-}
-
-func (x *License) Reset() {
-	*x = License{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_license_proto_msgTypes[0]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
-}
-
-func (x *License) String() string {
-	return protoimpl.X.MessageStringOf(x)
-}
-
-func (*License) ProtoMessage() {}
-
-func (x *License) ProtoReflect() protoreflect.Message {
-	mi := &file_vince_v1_license_proto_msgTypes[0]
-	if protoimpl.UnsafeEnabled && x != nil {
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		if ms.LoadMessageInfo() == nil {
-			ms.StoreMessageInfo(mi)
-		}
-		return ms
-	}
-	return mi.MessageOf(x)
-}
-
-// Deprecated: Use License.ProtoReflect.Descriptor instead.
-func (*License) Descriptor() ([]byte, []int) {
-	return file_vince_v1_license_proto_rawDescGZIP(), []int{0}
-}
-
-func (x *License) GetExpiry() uint64 {
-	if x != nil {
-		return x.Expiry
-	}
-	return 0
-}
-
-func (x *License) GetEmail() string {
-	if x != nil {
-		return x.Email
-	}
-	return ""
-}
-
-var File_vince_v1_license_proto protoreflect.FileDescriptor
-
-var file_vince_v1_license_proto_rawDesc = []byte{
-	0x0a, 0x16, 0x76, 0x69, 0x6e, 0x63, 0x65, 0x2f, 0x76, 0x31, 0x2f, 0x6c, 0x69, 0x63, 0x65, 0x6e,
-	0x73, 0x65, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x12, 0x02, 0x76, 0x31, 0x22, 0x37, 0x0a, 0x07,
-	0x4c, 0x69, 0x63, 0x65, 0x6e, 0x73, 0x65, 0x12, 0x16, 0x0a, 0x06, 0x65, 0x78, 0x70, 0x69, 0x72,
-	0x79, 0x18, 0x04, 0x20, 0x01, 0x28, 0x04, 0x52, 0x06, 0x65, 0x78, 0x70, 0x69, 0x72, 0x79, 0x12,
-	0x14, 0x0a, 0x05, 0x65, 0x6d, 0x61, 0x69, 0x6c, 0x18, 0x05, 0x20, 0x01, 0x28, 0x09, 0x52, 0x05,
-	0x65, 0x6d, 0x61, 0x69, 0x6c, 0x42, 0x6f, 0x0a, 0x06, 0x63, 0x6f, 0x6d, 0x2e, 0x76, 0x31, 0x42,
-	0x0c, 0x4c, 0x69, 0x63, 0x65, 0x6e, 0x73, 0x65, 0x50, 0x72, 0x6f, 0x74, 0x6f, 0x50, 0x01, 0x5a,
-	0x2f, 0x67, 0x69, 0x74, 0x68, 0x75, 0x62, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x76, 0x69, 0x6e, 0x63,
-	0x65, 0x61, 0x6e, 0x61, 0x6c, 0x79, 0x74, 0x69, 0x63, 0x73, 0x2f, 0x76, 0x69, 0x6e, 0x63, 0x65,
-	0x2f, 0x67, 0x65, 0x6e, 0x2f, 0x67, 0x6f, 0x2f, 0x76, 0x69, 0x6e, 0x63, 0x65, 0x2f, 0x76, 0x31,
-	0xa2, 0x02, 0x03, 0x56, 0x58, 0x58, 0xaa, 0x02, 0x02, 0x56, 0x31, 0xca, 0x02, 0x02, 0x56, 0x31,
-	0xe2, 0x02, 0x0e, 0x56, 0x31, 0x5c, 0x47, 0x50, 0x42, 0x4d, 0x65, 0x74, 0x61, 0x64, 0x61, 0x74,
-	0x61, 0xea, 0x02, 0x02, 0x56, 0x31, 0x62, 0x06, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x33,
-}
-
-var (
-	file_vince_v1_license_proto_rawDescOnce sync.Once
-	file_vince_v1_license_proto_rawDescData = file_vince_v1_license_proto_rawDesc
-)
-
-func file_vince_v1_license_proto_rawDescGZIP() []byte {
-	file_vince_v1_license_proto_rawDescOnce.Do(func() {
-		file_vince_v1_license_proto_rawDescData = protoimpl.X.CompressGZIP(file_vince_v1_license_proto_rawDescData)
-	})
-	return file_vince_v1_license_proto_rawDescData
-}
-
-var file_vince_v1_license_proto_msgTypes = make([]protoimpl.MessageInfo, 1)
-var file_vince_v1_license_proto_goTypes = []any{
-	(*License)(nil), // 0: v1.License
-}
-var file_vince_v1_license_proto_depIdxs = []int32{
-	0, // [0:0] is 
```

**File**: `gen/go/vince/v1/util.pb.go` (modified, +5/-21)
```diff
@@ -1,6 +1,6 @@
 // Code generated by protoc-gen-go. DO NOT EDIT.
 // versions:
-// 	protoc-gen-go v1.34.2
+// 	protoc-gen-go v1.35.2
 // 	protoc        (unknown)
 // source: vince/v1/util.proto
 
@@ -32,11 +32,9 @@ type Location struct {
 
 func (x *Location) Reset() {
 	*x = Location{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_util_proto_msgTypes[0]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_util_proto_msgTypes[0]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *Location) String() string {
@@ -47,7 +45,7 @@ func (*Location) ProtoMessage() {}
 
 func (x *Location) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_util_proto_msgTypes[0]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -132,20 +130,6 @@ func file_vince_v1_util_proto_init() {
 	if File_vince_v1_util_proto != nil {
 		return
 	}
-	if !protoimpl.UnsafeEnabled {
-		file_vince_v1_util_proto_msgTypes[0].Exporter = func(v any, i int) any {
-			switch v := v.(*Location); i {
-			case 0:
-				return &v.state
-			case 1:
-				return &v.sizeCache
-			case 2:
-				return &v.unknownFields
-			default:
-				return nil
-			}
-		}
-	}
 	type x struct{}
 	out := protoimpl.TypeBuilder{
 		File: protoimpl.DescBuilder{
```

**File**: `gen/go/vince/v1/vince.pb.go` (modified, +5/-21)
```diff
@@ -1,6 +1,6 @@
 // Code generated by protoc-gen-go. DO NOT EDIT.
 // versions:
-// 	protoc-gen-go v1.34.2
+// 	protoc-gen-go v1.35.2
 // 	protoc        (unknown)
 // source: vince/v1/vince.proto
 
@@ -32,11 +32,9 @@ type APIKey struct {
 
 func (x *APIKey) Reset() {
 	*x = APIKey{}
-	if protoimpl.UnsafeEnabled {
-		mi := &file_vince_v1_vince_proto_msgTypes[0]
-		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
-		ms.StoreMessageInfo(mi)
-	}
+	mi := &file_vince_v1_vince_proto_msgTypes[0]
+	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
+	ms.StoreMessageInfo(mi)
 }
 
 func (x *APIKey) String() string {
@@ -47,7 +45,7 @@ func (*APIKey) ProtoMessage() {}
 
 func (x *APIKey) ProtoReflect() protoreflect.Message {
 	mi := &file_vince_v1_vince_proto_msgTypes[0]
-	if protoimpl.UnsafeEnabled && x != nil {
+	if x != nil {
 		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
 		if ms.LoadMessageInfo() == nil {
 			ms.StoreMessageInfo(mi)
@@ -131,20 +129,6 @@ func file_vince_v1_vince_proto_init() {
 	if File_vince_v1_vince_proto != nil {
 		return
 	}
-	if !protoimpl.UnsafeEnabled {
-		file_vince_v1_vince_proto_msgTypes[0].Exporter = func(v any, i int) any {
-			switch v := v.(*APIKey); i {
-			case 0:
-				return &v.state
-			case 1:
-				return &v.sizeCache
-			case 2:
-				return &v.unknownFields
-			default:
-				return nil
-			}
-		}
-	}
 	type x struct{}
 	out := protoimpl.TypeBuilder{
 		File: protoimpl.DescBuilder{
```

---

### Incident Patch 10: `c34ef351` (2024-11-27)
**Commit Message**: fix acme key prefix

**File**: `internal/encoding/encoding.go` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ func APIKeyHash(hash []byte) []byte {
 
 func ACME(key []byte) []byte {
 	o := make([]byte, 2+len(key))
-	copy(o, keys.APIKeyHashPrefix)
+	copy(o, keys.AcmePrefix)
 	copy(o[2:], key)
 	return o
 }
```

**File**: `internal/encoding/encoding_test.go` (added, +87/-0)
```diff
@@ -0,0 +1,87 @@
+package encoding
+
+import (
+	"bytes"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+	"github.com/vinceanalytics/vince/internal/keys"
+	"github.com/vinceanalytics/vince/internal/models"
+)
+
+func TestPrefix(t *testing.T) {
+	type T struct {
+		name   string
+		prefix []byte
+		key    func() []byte
+	}
+
+	samples := []T{
+		{
+			"bitmap data",
+			keys.DataPrefix,
+			func() []byte {
+				var k Key
+				k.WriteData(Global, models.Field_domain, 0, 0, 0)
+				return k.Bytes()
+			},
+		},
+		{
+			"bitmap existence",
+			keys.DataExistsPrefix,
+			func() []byte {
+				var k Key
+				k.WriteExistence(Global, models.Field_domain, 0, 0, 0)
+				return k.Bytes()
+			},
+		},
+		{
+			"site",
+			keys.SitePrefix,
+			func() []byte {
+				return Site([]byte("test"))
+			},
+		},
+		{
+			"api key name",
+			keys.APIKeyNamePrefix,
+			func() []byte {
+				return APIKeyName([]byte("test"))
+			},
+		},
+		{
+			"api key hash",
+			keys.APIKeyHashPrefix,
+			func() []byte {
+				return APIKeyHash([]byte("test"))
+			},
+		},
+		{
+			"acme",
+			keys.AcmePrefix,
+			func() []byte {
+				return ACME([]byte("test"))
+			},
+		},
+		{
+			"translate Key",
+			keys.TranslateKeyPrefix,
+			func() []byte {
+				return TranslateKey(models.Field_domain, []byte("test"))
+			},
+		},
+		{
+			"translate id",
+			keys.TranslateIDPrefix,
+			func() []byte {
+				return TranslateID(models.Field_domain, 0)
+			},
+		},
+	}
+
+	for _, s := range samples {
+		t.Run(s.name, func(t *testing.T) {
+			require.True(t, bytes.HasPrefix(s.key(), s.prefix))
+		})
+	}
+}
```

**File**: `internal/encoding/translate.go` (modified, +0/-7)
```diff
@@ -22,10 +22,3 @@ func TranslateID(field models.Field, id uint64) []byte {
 	binary.BigEndian.PutUint64(o[3:], id)
 	return o
 }
-
-func TranslateSeq(field models.Field, o []byte) []byte {
-	_ = o[2]
-	copy(o, keys.TranslateSeqPrefix)
-	o[2] = byte(field)
-	return o
-}
```

**File**: `internal/util/acme/acme_cache_test.go` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+package acme
+
+import (
+	"testing"
+
+	"github.com/cockroachdb/pebble"
+	"github.com/stretchr/testify/require"
+	"golang.org/x/crypto/acme/autocert"
+)
+
+func TestCache(t *testing.T) {
+	db, err := pebble.Open(t.TempDir(), nil)
+	require.NoError(t, err)
+	defer db.Close()
+
+	ca := New(db)
+
+	key := "test"
+
+	_, err = ca.Get(nil, key)
+	require.Equal(t, autocert.ErrCacheMiss, err)
+
+	require.NoError(t, ca.Put(nil, key, []byte(key)))
+
+	value, err := ca.Get(nil, key)
+	require.NoError(t, err)
+	require.Equal(t, key, string(value))
+}
```

#### Recent Merged Pull Requests:
- **PR #92** (closed): feat: add dark mode toggle and project labels (@jikkuatwork)
- **PR #88** (closed): New (@jicanghaixb)
- **PR #86** (2025-09-01): fix: custom range query (@beeb)
- **PR #85** (2025-08-31): fix: stats (@beeb)
- **PR #75** (closed): Fix: Password-protected shared links were accessible without a password (@AmeerDlshad)
- **PR #59** (closed): add new  storage (@gernest)
- **PR #57** (2025-03-16): store resolution in columns (@gernest)
- **PR #54** (2025-03-15): remove domain id in key space (@gernest)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
