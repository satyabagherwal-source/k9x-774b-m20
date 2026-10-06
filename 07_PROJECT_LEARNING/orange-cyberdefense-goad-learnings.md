# Forensic Learning Record (Deep Inspection): Orange-Cyberdefense/GOAD

> **Canonical Artifact**: `07_PROJECT_LEARNING/orange-cyberdefense-goad-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Orange-Cyberdefense/GOAD](https://github.com/Orange-Cyberdefense/GOAD))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:07:29.801Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Orange-Cyberdefense/GOAD`
- **Description**: game of active directory
- **Primary Language / Ecosystem**: PowerShell
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 8433 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `goad/utils.py`
```
from pathlib import Path
import os
import random
import string
import ipaddress
import platform

# constants
LAB = 'lab'
PROVIDER = 'provider'
PROVISIONER = 'provisioner'
IP_RANGE = 'ip_range'

# log level
INFO = 5
VERBOSE = 2
DEBUG = 1

# providers
AWS = 'aws'
VIRTUALBOX = 'virtualbox'
AZURE = 'azure'
VMWARE = 'vmware'
VMWARE_ESXI = 'vmware_esxi'
PROXMOX = 'proxmox'
LUDUS = 'ludus'
ALLOWED_PROVIDERS = [AWS, VIRTUALBOX, AZURE, VMWARE, VMWARE_ESXI, PROXMOX, LUDUS]

# provisioning method
PROVISIONING_LOCAL = 'local'
PROVISIONING_RUNNER = 'runner'
PROVISIONING_REMOTE = 'remote'
PROVISIONING_VM = 'vm'
PROVISIONING_DOCKER = 'docker'
ALLOWED_PROVISIONER = [PROVISIONING_LOCAL, PROVISIONING_REMOTE, PROVISIONING_VM, PROVISIONING_RUNNER, PROVISIONING_DOCKER]

# provisioner allowed
# AWS_ALLOWED_PROVISIONER = [PROVISIONING_REMOTE]
# AZURE_ALLOWED_PROVISIONER = [PROVISIONING_REMOTE]
# PROXMOX_ALLOWED_PROVISIONER = [PROVISIONING_LOCAL, PROVISIONING_RUNNER]
# VMWARE_ALLOWED_PROVISIONER = [PROVISIONING_LOCAL, PROVISIONING_RUNNER, PROVISIONING_DOCKER]
# VIRTUALBOX_ALLOWED_PROVISIONER = [PROVISIONING_LOCAL, PROVISIONING_RUNNER, PROVISIONING_DOCKER]
# LUDUS_ALLOWED_PROVISIONER = [PROVISIONING_LOCAL, PROVISIONING_RUNNER]

project_path = os.path.normpath(os.path.dirname(os.path.abspath(__file__)) + os.path.sep + '..')

# instance status
CREATED = 'not provided'
PROVIDED = 'ready for provisioning'
READY = 'installed'

# tasks
TASK_INSTALL = 'install'
TASK_CHECK = 'check'
TASK_START = 'start'
TASK_STOP = 'stop'
TASK_RESTART = 'restart'
TASK_DESTROY = 'destroy'
TASK_STATUS = 'status'
TASK_SNAPSHOT = 'snapshot'
TASK_RESET = 'reset'


class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]


class Utils:

    @staticmethod
    def is_wsl():
        version = platform.uname().release
        if version.endswith("-Microsoft"):
            return True
        elif version.endswith("microsoft-standard-WSL2"):
            return True
        return False

    @staticmethod
    def is_windows():
        if not Utils.is_wsl() and platform.system() == 'Windows':
            return True
        return False

    @staticmethod
    def confirm(message):
        result = input(f"{message}")
        if result == "y" or result == "Y" or result == "Yes":
            return True
        return False

    @staticmethod
    def is_valid_ipv4(ip):
        try:
            # Try to create an IPv4 object from the input
            ipaddress.IPv4Address(ip)
            return True
        except ValueError:
            return False

    @staticmethod
    def list_folders(path):
        if os.path.isdir(path):
            return [p.name for p in Path(path).iterdir() if p.is_dir()]
        else:
            return []

    @staticmethod
    def list_files(path):
        f = []
        for (dirpath, dirnames, filenames) in os.walk(path):
            f.extend(filenames)
            break
        return f

    @staticmethod
    def get_relative_path(path):
        return path[len(project_path):]

    @staticmethod
    def transform_local_path_to_remote_path(origin, remote_project_path):
        result_path = remote_project_path + origin[len(project_path):]
        if Utils.is_windows():
            result_path = result_path.replace('\\', '/')
        return result_path

    @staticmethod
    def get_random_string(length):
        # choose from all lowercase letter
        letters = string.ascii_lowercase
        result_str = ''.join(random.choice(letters) for i in range(length))
        return result_str

    @staticmethod
    def replace_in_file(filename, search_string, new_string):
        if os.path.isfile(filename):
            # Read in the file
            with open(filename, 'r') as file:
                filedata = file.read()

            # Replace the target string
            filedata = filedata.replace(search_string, new_string)

            # Write the file out again
            with open(filename, 'w') as file:
                file.write(filedata)
            return True
        return False

```

### Core Architecture Module: `ad/NHA/files/wwwroot/Scripts/bootstrap.js`
```
/*!
 * Bootstrap v3.4.1 (https://getbootstrap.com/)
 * Copyright 2011-2019 Twitter, Inc.
 * Licensed under the MIT license
 */

if (typeof jQuery === 'undefined') {
  throw new Error('Bootstrap\'s JavaScript requires jQuery')
}

+function ($) {
  'use strict';
  var version = $.fn.jquery.split(' ')[0].split('.')
  if ((version[0] < 2 && version[1] < 9) || (version[0] == 1 && version[1] == 9 && version[2] < 1) || (version[0] > 3)) {
    throw new Error('Bootstrap\'s JavaScript requires jQuery version 1.9.1 or higher, but lower than version 4')
  }
}(jQuery);

/* ========================================================================
 * Bootstrap: transition.js v3.4.1
 * https://getbootstrap.com/docs/3.4/javascript/#transitions
 * ========================================================================
 * Copyright 2011-2019 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // CSS TRANSITION SUPPORT (Shoutout: https://modernizr.com/)
  // ============================================================

  function transitionEnd() {
    var el = document.createElement('bootstrap')

    var transEndEventNames = {
      WebkitTransition : 'webkitTransitionEnd',
      MozTransition    : 'transitionend',
      OTransition      : 'oTransitionEnd otransitionend',
      transition       : 'transitionend'
    }

    for (var name in transEndEventNames) {
      if (el.style[name] !== undefined) {
        return { end: transEndEventNames[name] }
      }
    }

    return false // explicit for ie8 (  ._.)
  }

  // https://blog.alexmaccaw.com/css-transitions
  $.fn.emulateTransitionEnd = function (duration) {
    var called = false
    var $el = this
    $(this).one('bsTransitionEnd', function () { called = true })
    var callback = function () { if (!called) $($el).trigger($.support.transition.end) }
    setTimeout(callback, duration)
    return this
  }

  $(function () {
    $.support.transition = transitionEnd()

    if (!$.support.transition) return

    $.event.special.bsTransitionEnd = {
      bindType: $.support.transition.end,
      delegateType: $.support.transition.end,
      handle: function (e) {
        if ($(e.target).is(this)) return e.handleObj.handler.apply(this, arguments)
      }
    }
  })

}(jQuery);

/* ========================================================================
 * Bootstrap: alert.js v3.4.1
 * https://getbootstrap.com/docs/3.4/javascript/#alerts
 * ========================================================================
 * Copyright 2011-2019 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // ALERT CLASS DEFINITION
  // ======================

  var dismiss = '[data-dismiss="alert"]'
  var Alert   = function (el) {
    $(el).on('click', dismiss, this.close)
  }

  Alert.VERSION = '3.4.1'

  Alert.TRANSITION_DURATION = 150

  Alert.prototype.close = function (e) {
    var $this    = $(this)
    var selector = $this.attr('data-target')

    if (!selector) {
      selector = $this.attr('href')
      selector = selector && selector.replace(/.*(?=#[^\s]*$)/, '') // strip for ie7
    }

    selector    = selector === '#' ? [] : selector
    var $parent = $(document).find(selector)

    if (e) e.preventDefault()

    if (!$parent.length) {
      $parent = $this.closest('.alert')
    }

    $parent.trigger(e = $.Event('close.bs.alert'))

    if (e.isDefaultPrevented()) return

    $parent.removeClass('in')

    function removeElement() {
      // detach from parent, fire event then clean up data
      $parent.detach().trigger('closed.bs.alert').remove()
    }

    $.support.transition && $parent.hasClass('fade') ?
      $parent
        .one('bsTransitionEnd', removeElement)
        .emulateTransitionEnd(Alert.TRANSITION_DURATION) :
      removeElement()
  }


  // ALERT PLUGIN DEFINITION
  // =======================

  function Plugin(option) {
    return this.each(function () {
      var $this = $(this)
      var data  = $this.data('bs.alert')

      if (!data) $this.data('bs.alert', (data = new Alert(this)))
      if (typeof option == 'string') data[option].call($this)
    })
  }

  var old = $.fn.alert

  $.fn.alert             = Plugin
  $.fn.alert.Constructor = Alert


  // ALERT NO CONFLICT
  // =================

  $.fn.alert.noConflict = function () {
    $.fn.alert = old
    return this
  }


  // ALERT DATA-API
  // ==============

  $(document).on('click.bs.alert.data-api', dismiss, Alert.prototype.close)

}(jQuery);

/* ========================================================================
 * Bootstrap: button.js v3.4.1
 * https://getbootstrap.com/docs/3.4/javascript/#buttons
 * ========================================================================
 * Copyright 2011-2019 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // BUTTON PUBLIC CLASS DEFINITION
  // ==============================

  var Button = function (element, options) {
    this.$element  = $(element)
    this.options   = $.extend({}, Button.DEFAULTS, options)
    this.isLoading = false
  }

  Button.VERSION  = '3.4.1'

  Button.DEFAULTS = {
    loadingText: 'loading...'
  }

  Button.prototype.setState = function (state) {
    var d    = 'disabled'
    var $el  = this.$element
    var val  = $el.is('input') ? 'val' : 'html'
    var data = $el.data()

    state += 'Text'

    if (data.resetText == null) $el.data('resetText', $el[val]())

    // push to event loop to allow forms to submit
    setTimeout($.proxy(function () {
      $el[val](data[state] == null ? this.options[state] : data[state])

      if (state == 'loadingText') {
        this.isLoading = true
        $el.addClass(d).attr(d, d).prop(d, true)
      } else if (this.isLoading) {
        this.isLoading = false
        $el.removeClass(d).removeAttr(d).prop(d, false)
      }
    }, this), 0)
  }

  Button.prototype.toggle = function () {
    var changed = true
    var $parent = this.$element.closest('[data-toggle="buttons"]')

    if ($parent.length) {
      var $input = this.$element.find('input')
      if ($input.prop('type') == 'radio') {
        if ($input.prop('checked')) changed = false
        $parent.find('.active').removeClass('active')
        this.$element.addClass('active')
      } else if ($input.prop('type') == 'checkbox') {
        if (($input.prop('checked')) !== this.$element.hasClass('active')) changed = false
        this.$element.toggleClass('active')
      }
      $input.prop('checked', this.$element.hasClass('active'))
      if (changed) $input.trigger('change')
    } else {
      this.$element.attr('aria-pressed', !this.$element.hasClass('active'))
      this.$element.toggleClass('active')
    }
  }


  // BUTTON PLUGIN DEFINITION
  // ========================

  function Plugin(option) {
    return this.each(function () {
      var $this   = $(this)
      var data    = $this.data('bs.button')
      var options = typeof option == 'object' && option

      if (!data) $this.data('bs.button', (data = new Button(this, options)))

      if (option == 'toggle') data.toggle()
      else if (option) data.setState(option)
    })
  }

  var old = $.fn.button

  $.fn.button             = Plugin
  $.fn.button.Constructor = Button


  // BUTTON NO CONFLICT
  // ==================

  $.fn.button.noConflict = function () {
    $.fn.button = old
    return this
  }


  // BUTTON DATA-API
  // ===============

  $(document)
    .on('click.bs.button.data-api', '[data-toggle^="button"]', function (e) {
      var $btn = $(e.target).closest('.btn')
      Plugin.call($btn, 'toggle')
      if (!($(e.target).is('input[type="radio"], input[type="checkbox"]'))) {
        // Prevent double click on radios, and the double selections (so cancellation) on checkboxes
        e.preventDefault()
        // The target component still receive the focus
        if ($btn.is('input,button')) $btn.trigger('focus')
        else $btn.find('input:visible,button:visible').first().trigger('focus')
      }
    })
    .on('focus.bs.button.data-api blur.bs.button.data-api', '[data-toggle^="button"]', function (e) {
      $(e.target).closest('.btn').toggleClass('focus', /^focus(in)?$/.test(e.type))
    })

}(jQuery);

/* ========================================================================
 * Bootstrap: carousel.js v3.4.1
 * https://getbootstrap.com/docs/3.4/javascript/#carousel
 * ========================================================================
 * Copyright 2011-2019 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * ======================================================================== */


+function ($) {
  'use strict';

  // CAROUSEL CLASS DEFINITION
  // =========================

  var Carousel = function (element, options) {
    this.$element    = $(element)
    this.$indicators = this.$element.find('.carousel-indicators')
    this.options     = options
    this.paused      = null
    this.sliding     = null
    this.interval    = null
    this.$active     = null
    this.$items      = null

    this.options.keyboard && this.$element.on('keydown.bs.carousel', $.proxy(this.keydown, this))

    this.options.pause == 'hover' && !('ontouchstart' in document.documentElement) && this.$element
      .on('mouseenter.bs.carousel', $.proxy(this.pause, this))
      .on('mouseleave.bs.carousel', $.proxy(this.cycle, this))
  }

  Carousel.VERSION  = '3.4.1'

  Carousel.TRANSITION_DURATION = 600

  Carousel.DEFAULTS = {
    interval: 5000,
    pause: 'hover',
    wrap: true,
    keyboard: true
  }

  Carousel.prototype.keydown = function (e) {
    if (/input|texta
```

### Core Architecture Module: `ad/NHA/files/wwwroot/Scripts/jquery-3.4.1.js`
```
/*!
 * jQuery JavaScript Library v3.4.1
 * https://jquery.com/
 *
 * Includes Sizzle.js
 * https://sizzlejs.com/
 *
 * Copyright JS Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2019-05-01T21:04Z
 */
( function( global, factory ) {

	"use strict";

	if ( typeof module === "object" && typeof module.exports === "object" ) {

		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
} )( typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Edge <= 12 - 13+, Firefox <=18 - 45+, IE 10 - 11, Safari 5.1 - 9+, iOS 6 - 9.1
// throw exceptions when non-strict code (e.g., ASP.NET 4.5) accesses strict mode
// arguments.callee.caller (trac-13335). But as of jQuery 3.0 (2016), strict mode should be common
// enough that all such attempts are guarded in a try block.
"use strict";

var arr = [];

var document = window.document;

var getProto = Object.getPrototypeOf;

var slice = arr.slice;

var concat = arr.concat;

var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var fnToString = hasOwn.toString;

var ObjectFunctionString = fnToString.call( Object );

var support = {};

var isFunction = function isFunction( obj ) {

      // Support: Chrome <=57, Firefox <=52
      // In some browsers, typeof returns "function" for HTML <object> elements
      // (i.e., `typeof document.createElement( "object" ) === "function"`).
      // We don't want to classify *any* DOM node as a function.
      return typeof obj === "function" && typeof obj.nodeType !== "number";
  };


var isWindow = function isWindow( obj ) {
		return obj != null && obj === obj.window;
	};




	var preservedScriptAttributes = {
		type: true,
		src: true,
		nonce: true,
		noModule: true
	};

	function DOMEval( code, node, doc ) {
		doc = doc || document;

		var i, val,
			script = doc.createElement( "script" );

		script.text = code;
		if ( node ) {
			for ( i in preservedScriptAttributes ) {

				// Support: Firefox 64+, Edge 18+
				// Some browsers don't support the "nonce" property on scripts.
				// On the other hand, just using `getAttribute` is not enough as
				// the `nonce` attribute is reset to an empty string whenever it
				// becomes browsing-context connected.
				// See https://github.com/whatwg/html/issues/2369
				// See https://html.spec.whatwg.org/#nonce-attributes
				// The `node.getAttribute` check was added for the sake of
				// `jQuery.globalEval` so that it can fake a nonce-containing node
				// via an object.
				val = node[ i ] || node.getAttribute && node.getAttribute( i );
				if ( val ) {
					script.setAttribute( i, val );
				}
			}
		}
		doc.head.appendChild( script ).parentNode.removeChild( script );
	}


function toType( obj ) {
	if ( obj == null ) {
		return obj + "";
	}

	// Support: Android <=2.3 only (functionish RegExp)
	return typeof obj === "object" || typeof obj === "function" ?
		class2type[ toString.call( obj ) ] || "object" :
		typeof obj;
}
/* global Symbol */
// Defining this global in .eslintrc.json would create a danger of using the global
// unguarded in another place, it seems safer to define global only for this module



var
	version = "3.4.1",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {

		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android <=4.0 only
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;

jQuery.fn = jQuery.prototype = {

	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {

		// Return all the elements in a clean array
		if ( num == null ) {
			return slice.call( this );
		}

		// Return just the one element from the set
		return num < 0 ? this[ num + this.length ] : this[ num ];
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	each: function( callback ) {
		return jQuery.each( this, callback );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map( this, function( elem, i ) {
			return callback.call( elem, i, elem );
		} ) );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor();
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[ 0 ] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// Skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !isFunction( target ) ) {
		target = {};
	}

	// Extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {

		// Only deal with non-null/undefined values
		if ( ( options = arguments[ i ] ) != null ) {

			// Extend the base object
			for ( name in options ) {
				copy = options[ name ];

				// Prevent Object.prototype pollution
				// Prevent never-ending loop
				if ( name === "__proto__" || target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
					( copyIsArray = Array.isArray( copy ) ) ) ) {
					src = target[ name ];

					// Ensure proper type for the source value
					if ( copyIsArray && !Array.isArray( src ) ) {
						clone = [];
					} else if ( !copyIsArray && !jQuery.isPlainObject( src ) ) {
						clone = {};
					} else {
						clone = src;
					}
					copyIsArray = false;

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend( {

	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isPlainObject: function( obj ) {
		var proto, Ctor;

		// Detect obvious negatives
		// Use toString instead of jQuery.type to catch host objects
		if ( !obj || toString.call( obj ) !== "[object Object]" ) {
			return false;
		}

		proto = getProto( obj );

		// Objects with no prototype (e.g., `Object.create( null )`) are plain
		if ( !proto ) {
			return true;
		}

		// Objects with prototype are plain iff they were constructed by a global Object function
		Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
		return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
	},

	isEmptyObject: function( obj ) {
		var name;

		for ( name in obj ) {
			return false;
		}
		return true;
	},

	// Evaluates a script in a global context
	globalEval: function( code, options ) {
		DOMEval( code, { nonce: options && options.nonce } );
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},

	// Support: Android <=4.0 only
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArrayLike( Object( arr ) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	// Support: Android <=4.0 only, PhantomJS 1 o
```

### Core Architecture Module: `ad/NHA/files/wwwroot/Scripts/jquery-3.4.1.slim.js`
```
/*!
 * jQuery JavaScript Library v3.4.1 -ajax,-ajax/jsonp,-ajax/load,-ajax/parseXML,-ajax/script,-ajax/var/location,-ajax/var/nonce,-ajax/var/rquery,-ajax/xhr,-manipulation/_evalUrl,-event/ajax,-effects,-effects/Tween,-effects/animatedSelector
 * https://jquery.com/
 *
 * Includes Sizzle.js
 * https://sizzlejs.com/
 *
 * Copyright JS Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2019-05-01T21:04Z
 */
( function( global, factory ) {

	"use strict";

	if ( typeof module === "object" && typeof module.exports === "object" ) {

		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
} )( typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Edge <= 12 - 13+, Firefox <=18 - 45+, IE 10 - 11, Safari 5.1 - 9+, iOS 6 - 9.1
// throw exceptions when non-strict code (e.g., ASP.NET 4.5) accesses strict mode
// arguments.callee.caller (trac-13335). But as of jQuery 3.0 (2016), strict mode should be common
// enough that all such attempts are guarded in a try block.
"use strict";

var arr = [];

var document = window.document;

var getProto = Object.getPrototypeOf;

var slice = arr.slice;

var concat = arr.concat;

var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var fnToString = hasOwn.toString;

var ObjectFunctionString = fnToString.call( Object );

var support = {};

var isFunction = function isFunction( obj ) {

      // Support: Chrome <=57, Firefox <=52
      // In some browsers, typeof returns "function" for HTML <object> elements
      // (i.e., `typeof document.createElement( "object" ) === "function"`).
      // We don't want to classify *any* DOM node as a function.
      return typeof obj === "function" && typeof obj.nodeType !== "number";
  };


var isWindow = function isWindow( obj ) {
		return obj != null && obj === obj.window;
	};




	var preservedScriptAttributes = {
		type: true,
		src: true,
		nonce: true,
		noModule: true
	};

	function DOMEval( code, node, doc ) {
		doc = doc || document;

		var i, val,
			script = doc.createElement( "script" );

		script.text = code;
		if ( node ) {
			for ( i in preservedScriptAttributes ) {

				// Support: Firefox 64+, Edge 18+
				// Some browsers don't support the "nonce" property on scripts.
				// On the other hand, just using `getAttribute` is not enough as
				// the `nonce` attribute is reset to an empty string whenever it
				// becomes browsing-context connected.
				// See https://github.com/whatwg/html/issues/2369
				// See https://html.spec.whatwg.org/#nonce-attributes
				// The `node.getAttribute` check was added for the sake of
				// `jQuery.globalEval` so that it can fake a nonce-containing node
				// via an object.
				val = node[ i ] || node.getAttribute && node.getAttribute( i );
				if ( val ) {
					script.setAttribute( i, val );
				}
			}
		}
		doc.head.appendChild( script ).parentNode.removeChild( script );
	}


function toType( obj ) {
	if ( obj == null ) {
		return obj + "";
	}

	// Support: Android <=2.3 only (functionish RegExp)
	return typeof obj === "object" || typeof obj === "function" ?
		class2type[ toString.call( obj ) ] || "object" :
		typeof obj;
}
/* global Symbol */
// Defining this global in .eslintrc.json would create a danger of using the global
// unguarded in another place, it seems safer to define global only for this module



var
	version = "3.4.1 -ajax,-ajax/jsonp,-ajax/load,-ajax/parseXML,-ajax/script,-ajax/var/location,-ajax/var/nonce,-ajax/var/rquery,-ajax/xhr,-manipulation/_evalUrl,-event/ajax,-effects,-effects/Tween,-effects/animatedSelector",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {

		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android <=4.0 only
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;

jQuery.fn = jQuery.prototype = {

	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {

		// Return all the elements in a clean array
		if ( num == null ) {
			return slice.call( this );
		}

		// Return just the one element from the set
		return num < 0 ? this[ num + this.length ] : this[ num ];
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	each: function( callback ) {
		return jQuery.each( this, callback );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map( this, function( elem, i ) {
			return callback.call( elem, i, elem );
		} ) );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor();
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[ 0 ] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// Skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !isFunction( target ) ) {
		target = {};
	}

	// Extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {

		// Only deal with non-null/undefined values
		if ( ( options = arguments[ i ] ) != null ) {

			// Extend the base object
			for ( name in options ) {
				copy = options[ name ];

				// Prevent Object.prototype pollution
				// Prevent never-ending loop
				if ( name === "__proto__" || target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
					( copyIsArray = Array.isArray( copy ) ) ) ) {
					src = target[ name ];

					// Ensure proper type for the source value
					if ( copyIsArray && !Array.isArray( src ) ) {
						clone = [];
					} else if ( !copyIsArray && !jQuery.isPlainObject( src ) ) {
						clone = {};
					} else {
						clone = src;
					}
					copyIsArray = false;

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend( {

	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isPlainObject: function( obj ) {
		var proto, Ctor;

		// Detect obvious negatives
		// Use toString instead of jQuery.type to catch host objects
		if ( !obj || toString.call( obj ) !== "[object Object]" ) {
			return false;
		}

		proto = getProto( obj );

		// Objects with no prototype (e.g., `Object.create( null )`) are plain
		if ( !proto ) {
			return true;
		}

		// Objects with prototype are plain iff they were constructed by a global Object function
		Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
		return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
	},

	isEmptyObject: function( obj ) {
		var name;

		for ( name in obj ) {
			return false;
		}
		return true;
	},

	// Evaluates a script in a global context
	globalEval: function( code, options ) {
		DOMEval( code, { nonce: options && options.nonce } );
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},

	// Support: Android <=4.0 only
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: funct
```

### Core Architecture Module: `ad/NHA/files/wwwroot/Scripts/jquery.validate.js`
```
/*!
 * jQuery Validation Plugin v1.17.0
 *
 * https://jqueryvalidation.org/
 *
 * Copyright (c) 2017 Jörn Zaefferer
 * Released under the MIT license
 */
(function( factory ) {
	if ( typeof define === "function" && define.amd ) {
		define( ["jquery"], factory );
	} else if (typeof module === "object" && module.exports) {
		module.exports = factory( require( "jquery" ) );
	} else {
		factory( jQuery );
	}
}(function( $ ) {

$.extend( $.fn, {

	// https://jqueryvalidation.org/validate/
	validate: function( options ) {

		// If nothing is selected, return nothing; can't chain anyway
		if ( !this.length ) {
			if ( options && options.debug && window.console ) {
				console.warn( "Nothing selected, can't validate, returning nothing." );
			}
			return;
		}

		// Check if a validator for this form was already created
		var validator = $.data( this[ 0 ], "validator" );
		if ( validator ) {
			return validator;
		}

		// Add novalidate tag if HTML5.
		this.attr( "novalidate", "novalidate" );

		validator = new $.validator( options, this[ 0 ] );
		$.data( this[ 0 ], "validator", validator );

		if ( validator.settings.onsubmit ) {

			this.on( "click.validate", ":submit", function( event ) {

				// Track the used submit button to properly handle scripted
				// submits later.
				validator.submitButton = event.currentTarget;

				// Allow suppressing validation by adding a cancel class to the submit button
				if ( $( this ).hasClass( "cancel" ) ) {
					validator.cancelSubmit = true;
				}

				// Allow suppressing validation by adding the html5 formnovalidate attribute to the submit button
				if ( $( this ).attr( "formnovalidate" ) !== undefined ) {
					validator.cancelSubmit = true;
				}
			} );

			// Validate the form on submit
			this.on( "submit.validate", function( event ) {
				if ( validator.settings.debug ) {

					// Prevent form submit to be able to see console output
					event.preventDefault();
				}
				function handle() {
					var hidden, result;

					// Insert a hidden input as a replacement for the missing submit button
					// The hidden input is inserted in two cases:
					//   - A user defined a `submitHandler`
					//   - There was a pending request due to `remote` method and `stopRequest()`
					//     was called to submit the form in case it's valid
					if ( validator.submitButton && ( validator.settings.submitHandler || validator.formSubmitted ) ) {
						hidden = $( "<input type='hidden'/>" )
							.attr( "name", validator.submitButton.name )
							.val( $( validator.submitButton ).val() )
							.appendTo( validator.currentForm );
					}

					if ( validator.settings.submitHandler ) {
						result = validator.settings.submitHandler.call( validator, validator.currentForm, event );
						if ( hidden ) {

							// And clean up afterwards; thanks to no-block-scope, hidden can be referenced
							hidden.remove();
						}
						if ( result !== undefined ) {
							return result;
						}
						return false;
					}
					return true;
				}

				// Prevent submit for invalid forms or custom submit handlers
				if ( validator.cancelSubmit ) {
					validator.cancelSubmit = false;
					return handle();
				}
				if ( validator.form() ) {
					if ( validator.pendingRequest ) {
						validator.formSubmitted = true;
						return false;
					}
					return handle();
				} else {
					validator.focusInvalid();
					return false;
				}
			} );
		}

		return validator;
	},

	// https://jqueryvalidation.org/valid/
	valid: function() {
		var valid, validator, errorList;

		if ( $( this[ 0 ] ).is( "form" ) ) {
			valid = this.validate().form();
		} else {
			errorList = [];
			valid = true;
			validator = $( this[ 0 ].form ).validate();
			this.each( function() {
				valid = validator.element( this ) && valid;
				if ( !valid ) {
					errorList = errorList.concat( validator.errorList );
				}
			} );
			validator.errorList = errorList;
		}
		return valid;
	},

	// https://jqueryvalidation.org/rules/
	rules: function( command, argument ) {
		var element = this[ 0 ],
			settings, staticRules, existingRules, data, param, filtered;

		// If nothing is selected, return empty object; can't chain anyway
		if ( element == null ) {
			return;
		}

		if ( !element.form && element.hasAttribute( "contenteditable" ) ) {
			element.form = this.closest( "form" )[ 0 ];
			element.name = this.attr( "name" );
		}

		if ( element.form == null ) {
			return;
		}

		if ( command ) {
			settings = $.data( element.form, "validator" ).settings;
			staticRules = settings.rules;
			existingRules = $.validator.staticRules( element );
			switch ( command ) {
			case "add":
				$.extend( existingRules, $.validator.normalizeRule( argument ) );

				// Remove messages from rules, but allow them to be set separately
				delete existingRules.messages;
				staticRules[ element.name ] = existingRules;
				if ( argument.messages ) {
					settings.messages[ element.name ] = $.extend( settings.messages[ element.name ], argument.messages );
				}
				break;
			case "remove":
				if ( !argument ) {
					delete staticRules[ element.name ];
					return existingRules;
				}
				filtered = {};
				$.each( argument.split( /\s/ ), function( index, method ) {
					filtered[ method ] = existingRules[ method ];
					delete existingRules[ method ];
				} );
				return filtered;
			}
		}

		data = $.validator.normalizeRules(
		$.extend(
			{},
			$.validator.classRules( element ),
			$.validator.attributeRules( element ),
			$.validator.dataRules( element ),
			$.validator.staticRules( element )
		), element );

		// Make sure required is at front
		if ( data.required ) {
			param = data.required;
			delete data.required;
			data = $.extend( { required: param }, data );
		}

		// Make sure remote is at back
		if ( data.remote ) {
			param = data.remote;
			delete data.remote;
			data = $.extend( data, { remote: param } );
		}

		return data;
	}
} );

// Custom selectors
$.extend( $.expr.pseudos || $.expr[ ":" ], {		// '|| $.expr[ ":" ]' here enables backwards compatibility to jQuery 1.7. Can be removed when dropping jQ 1.7.x support

	// https://jqueryvalidation.org/blank-selector/
	blank: function( a ) {
		return !$.trim( "" + $( a ).val() );
	},

	// https://jqueryvalidation.org/filled-selector/
	filled: function( a ) {
		var val = $( a ).val();
		return val !== null && !!$.trim( "" + val );
	},

	// https://jqueryvalidation.org/unchecked-selector/
	unchecked: function( a ) {
		return !$( a ).prop( "checked" );
	}
} );

// Constructor for validator
$.validator = function( options, form ) {
	this.settings = $.extend( true, {}, $.validator.defaults, options );
	this.currentForm = form;
	this.init();
};

// https://jqueryvalidation.org/jQuery.validator.format/
$.validator.format = function( source, params ) {
	if ( arguments.length === 1 ) {
		return function() {
			var args = $.makeArray( arguments );
			args.unshift( source );
			return $.validator.format.apply( this, args );
		};
	}
	if ( params === undefined ) {
		return source;
	}
	if ( arguments.length > 2 && params.constructor !== Array  ) {
		params = $.makeArray( arguments ).slice( 1 );
	}
	if ( params.constructor !== Array ) {
		params = [ params ];
	}
	$.each( params, function( i, n ) {
		source = source.replace( new RegExp( "\\{" + i + "\\}", "g" ), function() {
			return n;
		} );
	} );
	return source;
};

$.extend( $.validator, {

	defaults: {
		messages: {},
		groups: {},
		rules: {},
		errorClass: "error",
		pendingClass: "pending",
		validClass: "valid",
		errorElement: "label",
		focusCleanup: false,
		focusInvalid: true,
		errorContainer: $( [] ),
		errorLabelContainer: $( [] ),
		onsubmit: true,
		ignore: ":hidden",
		ignoreTitle: false,
		onfocusin: function( element ) {
			this.lastActive = element;

			// Hide error label and remove error class on focus if enabled
			if ( this.settings.focusCleanup ) {
				if ( this.settings.unhighlight ) {
					this.settings.unhighlight.call( this, element, this.settings.errorClass, this.settings.validClass );
				}
				this.hideThese( this.errorsFor( element ) );
			}
		},
		onfocusout: function( element ) {
			if ( !this.checkable( element ) && ( element.name in this.submitted || !this.optional( element ) ) ) {
				this.element( element );
			}
		},
		onkeyup: function( element, event ) {

			// Avoid revalidate the field when pressing one of the following keys
			// Shift       => 16
			// Ctrl        => 17
			// Alt         => 18
			// Caps lock   => 20
			// End         => 35
			// Home        => 36
			// Left arrow  => 37
			// Up arrow    => 38
			// Right arrow => 39
			// Down arrow  => 40
			// Insert      => 45
			// Num lock    => 144
			// AltGr key   => 225
			var excludedKeys = [
				16, 17, 18, 20, 35, 36, 37,
				38, 39, 40, 45, 144, 225
			];

			if ( event.which === 9 && this.elementValue( element ) === "" || $.inArray( event.keyCode, excludedKeys ) !== -1 ) {
				return;
			} else if ( element.name in this.submitted || element.name in this.invalid ) {
				this.element( element );
			}
		},
		onclick: function( element ) {

			// Click on selects, radiobuttons and checkboxes
			if ( element.name in this.submitted ) {
				this.element( element );

			// Or option elements, check parent select in that case
			} else if ( element.parentNode.name in this.submitted ) {
				this.element( element.parentNode );
			}
		},
		highlight: function( element, errorClass, validClass ) {
			if ( element.type === "radio" ) {
				this.findByName( element.name ).addClass( errorClass ).removeClass( validClass );
			} else {
				$( element ).addClass( errorClass ).removeClass( validClass );
			}
		},
		unhighlight: function( element, errorClass, validClass ) {
			if ( element.type === "radio" ) {
				this.findByName( element.name ).removeClass( errorClass ).addClass( validClass );
			} else {
				$( element ).removeClass( errorClass ).addClass( validClass );
			}
		}
	},

	// https://jqueryvalidation.org/jQuery.validator.setDefaults/
```

### Core Architecture Module: `ad/NHA/files/wwwroot/Scripts/jquery.validate.unobtrusive.js`
```
// Unobtrusive validation support library for jQuery and jQuery Validate
// Copyright (c) .NET Foundation. All rights reserved.
// Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
// @version v3.2.11

/*jslint white: true, browser: true, onevar: true, undef: true, nomen: true, eqeqeq: true, plusplus: true, bitwise: true, regexp: true, newcap: true, immed: true, strict: false */
/*global document: false, jQuery: false */

(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define("jquery.validate.unobtrusive", ['jquery-validation'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // CommonJS-like environments that support module.exports     
        module.exports = factory(require('jquery-validation'));
    } else {
        // Browser global
        jQuery.validator.unobtrusive = factory(jQuery);
    }
}(function ($) {
    var $jQval = $.validator,
        adapters,
        data_validation = "unobtrusiveValidation";

    function setValidationValues(options, ruleName, value) {
        options.rules[ruleName] = value;
        if (options.message) {
            options.messages[ruleName] = options.message;
        }
    }

    function splitAndTrim(value) {
        return value.replace(/^\s+|\s+$/g, "").split(/\s*,\s*/g);
    }

    function escapeAttributeValue(value) {
        // As mentioned on http://api.jquery.com/category/selectors/
        return value.replace(/([!"#$%&'()*+,./:;<=>?@\[\\\]^`{|}~])/g, "\\$1");
    }

    function getModelPrefix(fieldName) {
        return fieldName.substr(0, fieldName.lastIndexOf(".") + 1);
    }

    function appendModelPrefix(value, prefix) {
        if (value.indexOf("*.") === 0) {
            value = value.replace("*.", prefix);
        }
        return value;
    }

    function onError(error, inputElement) {  // 'this' is the form element
        var container = $(this).find("[data-valmsg-for='" + escapeAttributeValue(inputElement[0].name) + "']"),
            replaceAttrValue = container.attr("data-valmsg-replace"),
            replace = replaceAttrValue ? $.parseJSON(replaceAttrValue) !== false : null;

        container.removeClass("field-validation-valid").addClass("field-validation-error");
        error.data("unobtrusiveContainer", container);

        if (replace) {
            container.empty();
            error.removeClass("input-validation-error").appendTo(container);
        }
        else {
            error.hide();
        }
    }

    function onErrors(event, validator) {  // 'this' is the form element
        var container = $(this).find("[data-valmsg-summary=true]"),
            list = container.find("ul");

        if (list && list.length && validator.errorList.length) {
            list.empty();
            container.addClass("validation-summary-errors").removeClass("validation-summary-valid");

            $.each(validator.errorList, function () {
                $("<li />").html(this.message).appendTo(list);
            });
        }
    }

    function onSuccess(error) {  // 'this' is the form element
        var container = error.data("unobtrusiveContainer");

        if (container) {
            var replaceAttrValue = container.attr("data-valmsg-replace"),
                replace = replaceAttrValue ? $.parseJSON(replaceAttrValue) : null;

            container.addClass("field-validation-valid").removeClass("field-validation-error");
            error.removeData("unobtrusiveContainer");

            if (replace) {
                container.empty();
            }
        }
    }

    function onReset(event) {  // 'this' is the form element
        var $form = $(this),
            key = '__jquery_unobtrusive_validation_form_reset';
        if ($form.data(key)) {
            return;
        }
        // Set a flag that indicates we're currently resetting the form.
        $form.data(key, true);
        try {
            $form.data("validator").resetForm();
        } finally {
            $form.removeData(key);
        }

        $form.find(".validation-summary-errors")
            .addClass("validation-summary-valid")
            .removeClass("validation-summary-errors");
        $form.find(".field-validation-error")
            .addClass("field-validation-valid")
            .removeClass("field-validation-error")
            .removeData("unobtrusiveContainer")
            .find(">*")  // If we were using valmsg-replace, get the underlying error
            .removeData("unobtrusiveContainer");
    }

    function validationInfo(form) {
        var $form = $(form),
            result = $form.data(data_validation),
            onResetProxy = $.proxy(onReset, form),
            defaultOptions = $jQval.unobtrusive.options || {},
            execInContext = function (name, args) {
                var func = defaultOptions[name];
                func && $.isFunction(func) && func.apply(form, args);
            };

        if (!result) {
            result = {
                options: {  // options structure passed to jQuery Validate's validate() method
                    errorClass: defaultOptions.errorClass || "input-validation-error",
                    errorElement: defaultOptions.errorElement || "span",
                    errorPlacement: function () {
                        onError.apply(form, arguments);
                        execInContext("errorPlacement", arguments);
                    },
                    invalidHandler: function () {
                        onErrors.apply(form, arguments);
                        execInContext("invalidHandler", arguments);
                    },
                    messages: {},
                    rules: {},
                    success: function () {
                        onSuccess.apply(form, arguments);
                        execInContext("success", arguments);
                    }
                },
                attachValidation: function () {
                    $form
                        .off("reset." + data_validation, onResetProxy)
                        .on("reset." + data_validation, onResetProxy)
                        .validate(this.options);
                },
                validate: function () {  // a validation function that is called by unobtrusive Ajax
                    $form.validate();
                    return $form.valid();
                }
            };
            $form.data(data_validation, result);
        }

        return result;
    }

    $jQval.unobtrusive = {
        adapters: [],

        parseElement: function (element, skipAttach) {
            /// <summary>
            /// Parses a single HTML element for unobtrusive validation attributes.
            /// </summary>
            /// <param name="element" domElement="true">The HTML element to be parsed.</param>
            /// <param name="skipAttach" type="Boolean">[Optional] true to skip attaching the
            /// validation to the form. If parsing just this single element, you should specify true.
            /// If parsing several elements, you should specify false, and manually attach the validation
            /// to the form when you are finished. The default is false.</param>
            var $element = $(element),
                form = $element.parents("form")[0],
                valInfo, rules, messages;

            if (!form) {  // Cannot do client-side validation without a form
                return;
            }

            valInfo = validationInfo(form);
            valInfo.options.rules[element.name] = rules = {};
            valInfo.options.messages[element.name] = messages = {};

            $.each(this.adapters, function () {
                var prefix = "data-val-" + this.name,
                    message = $element.attr(prefix),
                    paramValues = {};

                if (message !== undefined) {  // Compare against undefined, because an empty message is legal (and falsy)
                    prefix += "-";

                    $.each(this.params, function () {
                        paramValues[this] = $element.attr(prefix + this);
                    });

                    this.adapt({
                        element: element,
                        form: form,
                        message: message,
                        params: paramValues,
                        rules: rules,
                        messages: messages
                    });
                }
            });

            $.extend(rules, { "__dummy__": true });

            if (!skipAttach) {
                valInfo.attachValidation();
            }
        },

        parse: function (selector) {
            /// <summary>
            /// Parses all the HTML elements in the specified selector. It looks for input elements decorated
            /// with the [data-val=true] attribute value and enables validation according to the data-val-*
            /// attribute values.
            /// </summary>
            /// <param name="selector" type="String">Any valid jQuery selector.</param>

            // $forms includes all forms in selector's DOM hierarchy (parent, children and self) that have at least one
            // element with data-val=true
            var $selector = $(selector),
                $forms = $selector.parents()
                    .addBack()
                    .filter("form")
                    .add($selector.find("form"))
                    .has("[data-val=true]");

            $selector.find("[data-val=true]").each(function () {
                $jQval.unobtrusive.parseElement(this, true);
            });

            $forms.each(function () {
                var info = validationInfo(this);
                if (info) {
                    info.attachValidation();
                }
            });
        }
    };

    adapters = $jQval.unobtrusive.adapters;

    adapters.add = function (
```

### Core Architecture Module: `ad/NHA/files/wwwroot/Scripts/modernizr-2.8.3.js`
```
/*!
 * Modernizr v2.8.3
 * www.modernizr.com
 *
 * Copyright (c) Faruk Ates, Paul Irish, Alex Sexton
 * Available under the BSD and MIT licenses: www.modernizr.com/license/
 */

/*
 * Modernizr tests which native CSS3 and HTML5 features are available in
 * the current UA and makes the results available to you in two ways:
 * as properties on a global Modernizr object, and as classes on the
 * <html> element. This information allows you to progressively enhance
 * your pages with a granular level of control over the experience.
 *
 * Modernizr has an optional (not included) conditional resource loader
 * called Modernizr.load(), based on Yepnope.js (yepnopejs.com).
 * To get a build that includes Modernizr.load(), as well as choosing
 * which tests to include, go to www.modernizr.com/download/
 *
 * Authors        Faruk Ates, Paul Irish, Alex Sexton
 * Contributors   Ryan Seddon, Ben Alman
 */

window.Modernizr = (function( window, document, undefined ) {

    var version = '2.8.3',

    Modernizr = {},

    /*>>cssclasses*/
    // option for enabling the HTML classes to be added
    enableClasses = true,
    /*>>cssclasses*/

    docElement = document.documentElement,

    /**
     * Create our "modernizr" element that we do most feature tests on.
     */
    mod = 'modernizr',
    modElem = document.createElement(mod),
    mStyle = modElem.style,

    /**
     * Create the input element for various Web Forms feature tests.
     */
    inputElem /*>>inputelem*/ = document.createElement('input') /*>>inputelem*/ ,

    /*>>smile*/
    smile = ':)',
    /*>>smile*/

    toString = {}.toString,

    // TODO :: make the prefixes more granular
    /*>>prefixes*/
    // List of property values to set for css tests. See ticket #21
    prefixes = ' -webkit- -moz- -o- -ms- '.split(' '),
    /*>>prefixes*/

    /*>>domprefixes*/
    // Following spec is to expose vendor-specific style properties as:
    //   elem.style.WebkitBorderRadius
    // and the following would be incorrect:
    //   elem.style.webkitBorderRadius

    // Webkit ghosts their properties in lowercase but Opera & Moz do not.
    // Microsoft uses a lowercase `ms` instead of the correct `Ms` in IE8+
    //   erik.eae.net/archives/2008/03/10/21.48.10/

    // More here: github.com/Modernizr/Modernizr/issues/issue/21
    omPrefixes = 'Webkit Moz O ms',

    cssomPrefixes = omPrefixes.split(' '),

    domPrefixes = omPrefixes.toLowerCase().split(' '),
    /*>>domprefixes*/

    /*>>ns*/
    ns = {'svg': 'http://www.w3.org/2000/svg'},
    /*>>ns*/

    tests = {},
    inputs = {},
    attrs = {},

    classes = [],

    slice = classes.slice,

    featureName, // used in testing loop


    /*>>teststyles*/
    // Inject element with style element and some CSS rules
    injectElementWithStyles = function( rule, callback, nodes, testnames ) {

      var style, ret, node, docOverflow,
          div = document.createElement('div'),
          // After page load injecting a fake body doesn't work so check if body exists
          body = document.body,
          // IE6 and 7 won't return offsetWidth or offsetHeight unless it's in the body element, so we fake it.
          fakeBody = body || document.createElement('body');

      if ( parseInt(nodes, 10) ) {
          // In order not to give false positives we create a node for each test
          // This also allows the method to scale for unspecified uses
          while ( nodes-- ) {
              node = document.createElement('div');
              node.id = testnames ? testnames[nodes] : mod + (nodes + 1);
              div.appendChild(node);
          }
      }

      // <style> elements in IE6-9 are considered 'NoScope' elements and therefore will be removed
      // when injected with innerHTML. To get around this you need to prepend the 'NoScope' element
      // with a 'scoped' element, in our case the soft-hyphen entity as it won't mess with our measurements.
      // msdn.microsoft.com/en-us/library/ms533897%28VS.85%29.aspx
      // Documents served as xml will throw if using &shy; so use xml friendly encoded version. See issue #277
      style = ['&#173;','<style id="s', mod, '">', rule, '</style>'].join('');
      div.id = mod;
      // IE6 will false positive on some tests due to the style element inside the test div somehow interfering offsetHeight, so insert it into body or fakebody.
      // Opera will act all quirky when injecting elements in documentElement when page is served as xml, needs fakebody too. #270
      (body ? div : fakeBody).innerHTML += style;
      fakeBody.appendChild(div);
      if ( !body ) {
          //avoid crashing IE8, if background image is used
          fakeBody.style.background = '';
          //Safari 5.13/5.1.4 OSX stops loading if ::-webkit-scrollbar is used and scrollbars are visible
          fakeBody.style.overflow = 'hidden';
          docOverflow = docElement.style.overflow;
          docElement.style.overflow = 'hidden';
          docElement.appendChild(fakeBody);
      }

      ret = callback(div, rule);
      // If this is done after page load we don't want to remove the body so check if body exists
      if ( !body ) {
          fakeBody.parentNode.removeChild(fakeBody);
          docElement.style.overflow = docOverflow;
      } else {
          div.parentNode.removeChild(div);
      }

      return !!ret;

    },
    /*>>teststyles*/

    /*>>mq*/
    // adapted from matchMedia polyfill
    // by Scott Jehl and Paul Irish
    // gist.github.com/786768
    testMediaQuery = function( mq ) {

      var matchMedia = window.matchMedia || window.msMatchMedia;
      if ( matchMedia ) {
        return matchMedia(mq) && matchMedia(mq).matches || false;
      }

      var bool;

      injectElementWithStyles('@media ' + mq + ' { #' + mod + ' { position: absolute; } }', function( node ) {
        bool = (window.getComputedStyle ?
                  getComputedStyle(node, null) :
                  node.currentStyle)['position'] == 'absolute';
      });

      return bool;

     },
     /*>>mq*/


    /*>>hasevent*/
    //
    // isEventSupported determines if a given element supports the given event
    // kangax.github.com/iseventsupported/
    //
    // The following results are known incorrects:
    //   Modernizr.hasEvent("webkitTransitionEnd", elem) // false negative
    //   Modernizr.hasEvent("textInput") // in Webkit. github.com/Modernizr/Modernizr/issues/333
    //   ...
    isEventSupported = (function() {

      var TAGNAMES = {
        'select': 'input', 'change': 'input',
        'submit': 'form', 'reset': 'form',
        'error': 'img', 'load': 'img', 'abort': 'img'
      };

      function isEventSupported( eventName, element ) {

        element = element || document.createElement(TAGNAMES[eventName] || 'div');
        eventName = 'on' + eventName;

        // When using `setAttribute`, IE skips "unload", WebKit skips "unload" and "resize", whereas `in` "catches" those
        var isSupported = eventName in element;

        if ( !isSupported ) {
          // If it has no `setAttribute` (i.e. doesn't implement Node interface), try generic element
          if ( !element.setAttribute ) {
            element = document.createElement('div');
          }
          if ( element.setAttribute && element.removeAttribute ) {
            element.setAttribute(eventName, '');
            isSupported = is(element[eventName], 'function');

            // If property was created, "remove it" (by setting value to `undefined`)
            if ( !is(element[eventName], 'undefined') ) {
              element[eventName] = undefined;
            }
            element.removeAttribute(eventName);
          }
        }

        element = null;
        return isSupported;
      }
      return isEventSupported;
    })(),
    /*>>hasevent*/

    // TODO :: Add flag for hasownprop ? didn't last time

    // hasOwnProperty shim by kangax needed for Safari 2.0 support
    _hasOwnProperty = ({}).hasOwnProperty, hasOwnProp;

    if ( !is(_hasOwnProperty, 'undefined') && !is(_hasOwnProperty.call, 'undefined') ) {
      hasOwnProp = function (object, property) {
        return _hasOwnProperty.call(object, property);
      };
    }
    else {
      hasOwnProp = function (object, property) { /* yes, this can give false positives/negatives, but most of the time we don't care about those */
        return ((property in object) && is(object.constructor.prototype[property], 'undefined'));
      };
    }

    // Adapted from ES5-shim https://github.com/kriskowal/es5-shim/blob/master/es5-shim.js
    // es5.github.com/#x15.3.4.5

    if (!Function.prototype.bind) {
      Function.prototype.bind = function bind(that) {

        var target = this;

        if (typeof target != "function") {
            throw new TypeError();
        }

        var args = slice.call(arguments, 1),
            bound = function () {

            if (this instanceof bound) {

              var F = function(){};
              F.prototype = target.prototype;
              var self = new F();

              var result = target.apply(
                  self,
                  args.concat(slice.call(arguments))
              );
              if (Object(result) === result) {
                  return result;
              }
              return self;

            } else {

              return target.apply(
                  that,
                  args.concat(slice.call(arguments))
              );

            }

        };

        return bound;
      };
    }

    /**
     * setCss applies given styles to the Modernizr DOM node.
     */
    function setCss( str ) {
        mStyle.cssText = str;
    }

    /**
     * setCssAll extrapolates all vendor-specific css strings.
     */
    function setCssAll( str1, str2 ) {
        return setCss(prefixes.join(str1 + ';') + ( str2 || '' ));
    }

    /**
     * is returns a boolean for if typeof obj is exactly type.
     */
    function is( obj, type ) {
        return typeof 
```

### Core Architecture Module: `goad.py`
```
import cmd
import argparse
import sys
import time
from goad.config import Config
from goad.log import Log
from goad.exceptions import JumpBoxInitFailed
from goad.menu import print_menu, print_logo
from goad.infos import *


class Goad(cmd.Cmd):

    def __init__(self, args):
        super().__init__()
        # get the arguments
        self.args = args
        # prepare config, read configuration file and merge with args
        config = Config()
        config.merge_config(args)
        # prepare lab controller to manage labs
        # import lab manager after the loading of the dependencies to allow disabling some provider and provisioning method
        from goad.lab_manager import LabManager
        self.lab_manager = LabManager().init(config, args)

        if args.task == '' or args.task is None:
            Log.info('Start Loading default instance')
            # load instance marked as default only if no args are provided
            self.lab_manager.load_default_instance()

        self.welcome()
        # set current lab and provider
        self.refresh_prompt()

    def welcome(self):
        Log.info('lab instances :')
        # show instances tables
        self.lab_manager.lab_instances.show_instances(current_instance_id=self.lab_manager.get_current_instance_id())
        # show current configuration
        # self.lab_manager.show_settings()

    def refresh_prompt(self):
        if self.lab_manager.get_current_instance_id() == '':
            self.prompt = f"\n{self.lab_manager.inline_settings()} > "
        else:
            self.prompt = f"\n{self.lab_manager.inline_settings()} ({self.lab_manager.get_current_instance_id()}) > "

    def default(self, line):
        print()

    def do_help(self, arg):
        print_menu(self.lab_manager)

    def do_exit(self, arg):
        print('bye')
        return True

    # main commands
    def do_check(self, arg=''):
        self.lab_manager.check()

    def do_status(self, arg=''):
        if self.lab_manager.get_current_instance():
            self.lab_manager.get_current_instance().provider.status()

    def do_install(self, arg=''):
        self.do_create()

    def do_start(self, arg=''):
        if self.lab_manager.get_current_instance_provider():
            self.lab_manager.get_current_instance_provider().start()

    def do_start_vm(self, arg):
        if arg == '':
            Log.error('missing virtual machine name')
            Log.info('start_vm <vm>')
        else:
            self.lab_manager.get_current_instance_provider().start_vm(arg)

    def do_stop(self, arg=''):
        if self.lab_manager.get_current_instance_provider():
            self.lab_manager.get_current_instance_provider().stop()

    def do_stop_vm(self, arg):
        if arg == '':
            Log.error('missing virtual machine name')
            Log.info('stop_vm <vm>')
        else:
            self.lab_manager.get_current_instance_provider().stop_vm(arg)

    def do_destroy(self, arg=''):
        if self.lab_manager.get_current_instance_provider():
            self.lab_manager.get_current_instance_provider().destroy()

    def do_destroy_vm(self, arg):
        if arg == '':
            Log.error('missing virtual machine name')
            Log.info('destroy_vm <vm>')
        else:
            self.lab_manager.get_current_instance_provider().destroy_vm(arg)

    def do_snapshot(self, arg=''):
        self.do_stop()
        if self.lab_manager.get_current_instance_provider():
            self.lab_manager.get_current_instance_provider().snapshot()
        self.do_start()
    
    def do_reset(self, arg=''):
        self.do_stop()
        if self.lab_manager.get_current_instance_provider():
            self.lab_manager.get_current_instance_provider().reset()
        self.do_start()

    def do_provide(self, arg=''):
        result = self.lab_manager.get_current_instance_provider().install()
        if result:
            self.lab_manager.get_current_instance().set_status(PROVIDED)
            # if ip range change after provisioning
            if self.lab_manager.get_current_instance_provider().update_ip_range:
                Log.info('Update IP range')
                new_range = self.lab_manager.get_current_instance_provider().get_ip_range()
                if new_range is not None:
                    Log.info(f'new range : {new_range}')
                    self.lab_manager.get_current_instance().update_ip_range(new_range)
                    Log.info(f'reload instance')
                    # reload instance
                    instance_id = self.lab_manager.get_current_instance_id()
                    self.do_load(instance_id)
                    self.refresh_prompt()

    def do_provision(self, arg):
        if arg == '':
            Log.error('missing playbook argument')
            Log.info('provision <playbook>')
        else:
            start = time.time()
            # run playbook
            self.lab_manager.get_current_instance_provisioner().run(arg)
            time_provision = time.ctime(time.time() - start)[11:19]
            Log.info(f'Provisioned with {arg} in {time_provision}')

    def do_provision_lab(self, arg=''):
        start = time.time()
        provision_result = self.lab_manager.get_current_instance_provisioner().run()
        if provision_result:
            self.lab_manager.get_current_instance().set_status(READY)
            time_provision = time.ctime(time.time() - start)[11:19]
            Log.info(f'Lab successfully provisioned in {time_provision}')
        return provision_result

    def do_provision_lab_from(self, arg):
        start = time.time()
        provision_result = self.lab_manager.get_current_instance_provisioner().run_from(arg)
        if provision_result:
            self.lab_manager.get_current_instance().set_status(READY)
            time_provision = time.ctime(time.time() - start)[11:19]
            Log.info(f'Provisioned from {arg} in {time_provision}')

    def do_sync_source_jumpbox(self, arg=''):
        if self.lab_manager.get_current_instance_provisioner().use_jumpbox:
            self.lab_manager.get_current_instance_provisioner().sync_source_jumpbox()

    def do_prepare_jumpbox(self, arg=''):
        if self.lab_manager.get_current_instance_provisioner().use_jumpbox:
            jumpbox_ip = self.lab_manager.get_current_instance_provider().get_jumpbox_ip(self.lab_manager.get_ip_range())
            if jumpbox_ip is not None:
                self.lab_manager.get_current_instance_provisioner().prepare_jumpbox(jumpbox_ip)
            else:
                Log.error('cannot find jumpbox ip')

    def do_config(self, arg):
        self.lab_manager.show_settings()

    def do_ssh_jumpbox(self, arg):
        if self.lab_manager.get_current_instance_provisioner().use_jumpbox:
            try:
                jump_box = self.lab_manager.get_current_instance_provisioner().jumpbox
                jump_box.ssh()
            except JumpBoxInitFailed as e:
                Log.error('Jumpbox retrieve connection info failed, abort')
        else:
            Log.error('No jump box for this provider')

    def do_ssh_jumpbox_proxy(self, arg):
        if self.lab_manager.get_current_instance_provisioner().use_jumpbox:
            try:
                jump_box = self.lab_manager.get_current_instance_provisioner().jumpbox
                if arg.isnumeric() and 1024 < int(arg) <= 65535:
                    jump_box.ssh_proxy(arg)
                else:
                    Log.error(f'Port value invalid : {arg}')
            except JumpBoxInitFailed as e:
                Log.error('Jumpbox retrieve connection info failed, abort')
        else:
            Log.error('No jump box for this provider')

    # configuration
    def do_set_lab(self, arg):
        """
        Change/Set the lab to use
        :param arg: lab name
        :return: void
        """
        if arg == '':
            Log.error('missing lab argument')
            Log.info('set_lab <lab>')
        else:
            try:
                self.lab_manager.set_lab(arg)
                self.refresh_prompt()
            except ValueError as err:
                Log.error(err.args[0])
                Log.info('Available labs :')
                for lab in self.lab_manager.labs:
                    Log.info(f' - {lab}')

    def complete_set_lab(self, text, line, begidx, endidx):
        options = self.lab_manager.get_labs_options()
        if not text:
            completions = options
        else:
            completions = [option for option in options if option.startswith(text)]
        return completions

    def do_set_provider(self, arg):
        """
        Change/Set the provider to use
        :param arg: provider name
        :return: void
        """
        if arg == '':
            Log.error('missing provider argument')
            Log.info(f'set_provider <provider> (allowed values : {",".join(ALLOWED_PROVIDERS)})')
        else:
            try:
                self.lab_manager.set_provider(arg)
                self.refresh_prompt()
            except ValueError as err:
                Log.error(err.args[0])

    def complete_set_provider(self, text, line, begidx, endidx):
        options = self.lab_manager.get_provider_options()
        if not text:
            completions = options
        else:
            completions = [option for option in options if option.startswith(text)]
        return completions

    def do_set_provisioning_method(self, arg):
        if arg == '':
            Log.error('missing provisioner argument')
            Log.info(f'set_provisioner <provisioner> (allowed values : {",".join(ALLOWED_PROVISIONER)})')
        else:
            try:
                self.lab_manager.set_provisioner(arg)
                self.refresh_prompt()
            except ValueError as err:
                Log.error(err.args[0])

    def complete_set_provisioning_method(self, text, line, begidx, endidx):
        options = self.lab_manager.provisioning_
```

### Core Architecture Module: `goad/command/cmd.py`
```
import subprocess
import psutil
import sys
from goad.log import Log
from goad.utils import Utils
from goad.dependencies import Dependencies

class Command:

    def __init__(self):
        self.vagrant_bin = ''
        self.terraform_bin = ''

    # CHECK
    def is_in_path(self, bin_file, show_log=True):
        command = f'which {bin_file} >/dev/null'
        try:
            subprocess.run(command, shell=True, check=True)
            if show_log:
                Log.success(f'{bin_file} found in PATH')
            return True
        except subprocess.CalledProcessError as e:
            if show_log:
                Log.error(f'{bin_file} not found in PATH')
            return False

    def check_vagrant(self):
        return self.is_in_path(self.vagrant_bin)

    def check_vagrant_plugin(self, plugin_name, mandatory=True):
        try:
            result = subprocess.run([self.vagrant_bin, 'plugin', 'list'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if plugin_name in result.stdout:
                Log.success(f'vagrant plugin {plugin_name} is installed')
                return True
            else:
                if not mandatory:
                    Log.warning(f'Missing vagrant plugin {plugin_name}')
                else:
                    Log.error(f'Missing vagrant plugin {plugin_name}')
                    return False
        except FileNotFoundError:
            Log.error("Vagrant is not installed or not found in PATH.")
            return False

    def check_vmware_utility(self):
        pass

    def check_ovftool(self):
        pass

    def check_gem(self, gem_name):
        pass

    def check_vmware(self):
        pass

    def check_virtualbox(self):
        pass

    def check_terraform(self):
        return self.is_in_path(self.terraform_bin)

    def check_aws(self):
        return self.is_in_path('aws')

    def check_azure(self):
        return self.is_in_path('az')

    def check_rsync(self):
        return self.is_in_path('rsync')

    def check_ansible(self):
        if not Dependencies.provisioner_local_enabled and not Dependencies.provisioner_runner_enabled:
            Log.info('skip ansible check as no local and runner provisionner enabled')
            return True
        checks = [
            self.is_in_path('ansible-playbook'),
            self.check_ansible_galaxy('ansible.windows'),
            self.check_ansible_galaxy('community.general'),
            self.check_ansible_galaxy('community.windows'),
        ]
        return all(checks)

    def check_ansible_galaxy(self, collection):
        try:
            result = subprocess.run(['ansible-galaxy', 'collection', 'list'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd='./ansible')
            if collection in result.stdout:
                Log.success(f'Ansible galaxy collection {collection} is installed')
                return True
            else:
                Log.error(f'Missing ansible-galaxy collection {collection}')
                return False
        except FileNotFoundError:
            Log.error("ansible-galaxy is not installed or not found in PATH.")
            return False

    def check_ludus(self):
        # linux only
        pass

    def check_disk(self, min_disk_gb=120):
        # If the system has multiple mountpoints, '.' will correctly calculate the available space on the current disk
        disk_usage = psutil.disk_usage('.')
        free_disk_gb = disk_usage.free / (1024 ** 3)  # Convert bytes to GB
        if free_disk_gb < min_disk_gb:
            Log.warning(f'not enough disk space, only {str(free_disk_gb)} Gb available')
            return False
        return True

    def check_ram(self, min_ram_gb=24):
        total_ram_gb = psutil.virtual_memory().total / (1024 ** 3)  # Convert bytes to GB
        if total_ram_gb < min_ram_gb:
            Log.error('not enough ram on the system')
            return False
        return True

    # RUN
    def run_shell(self, command, path):
        try:
            Log.info('CWD: ' + Utils.get_relative_path(str(path)))
            Log.cmd(command)
            subprocess.run(command, cwd=path, shell=True)
        except subprocess.CalledProcessError as e:
            Log.error(f"An error occurred while running the command: {e}")

    def run_command(self, command, path):
        result = None
        try:
            Log.info('CWD: ' + Utils.get_relative_path(str(path)))
            Log.cmd(command)
            result = subprocess.run(command, cwd=path, stderr=sys.stderr, stdout=sys.stdout, shell=True)
        except subprocess.CalledProcessError as e:
            Log.error(f"An error occurred while running the command: {e}")
            return False
        return result.returncode == 0

    def run_vagrant(self, args, path):
        result = None
        try:
            command = [self.vagrant_bin]
            command += args
            Log.info('CWD: ' + Utils.get_relative_path(str(path)))
            Log.cmd(' '.join(command))
            result = subprocess.run(command, cwd=path, stderr=sys.stderr, stdout=sys.stdout)
        except subprocess.CalledProcessError as e:
            Log.error(f"An error occurred while running the command: {e}")
        return result.returncode == 0

    def run_terraform(self, args, path):
        result = None
        try:
            command = [self.terraform_bin]
            command += args
            Log.info('CWD: ' + Utils.get_relative_path(str(path)))
            Log.cmd(' '.join(command))
            result = subprocess.run(command, cwd=path, stderr=sys.stderr, stdout=sys.stdout)
        except subprocess.CalledProcessError as e:
            Log.error(f"An error occurred while running the command: {e}")
        return result.returncode == 0

    def run_terraform_output(self, args, path):
        result = None
        try:
            command = [self.terraform_bin, 'output', '-raw']
            command += args
            Log.info('CWD: ' + Utils.get_relative_path(str(path)))
            Log.cmd(' '.join(command))
            result = subprocess.run(command, cwd=path,
                                    stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE,
                                    text=True
                                    )
            if result.returncode != 0:
                print(f"Error: {result.stderr}")
                return None

            return result.stdout
        except subprocess.CalledProcessError as e:
            Log.error(f"An error occurred while running the command: {e}")
        return None

    def on_ludus(self):
        return self.is_in_path('ludus', False)

    def run_ludus(self, args, path, api_key, user_id='', impersonation=False):
        # linux only
        pass

    def run_docker_ansible(self, args, path, ansible_path, sudo):
        # linux only
        pass

    def run_ansible(self, args, path):
        result = None
        try:
            command = 'ansible-playbook '
            command += args
            Log.info('CWD: ' + Utils.get_relative_path(str(path)))
            Log.cmd(command)
            result = subprocess.run(command, cwd=path, stderr=sys.stderr, stdout=sys.stdout, shell=True)
        except subprocess.CalledProcessError as e:
            Log.error(f"An error occurred while running the command: {e}")
            return False
        return result.returncode == 0

    def run_docker_ansible(self, args, path, sudo):
        # Linux only
        pass

    def get_azure_account_output(self):
        result = subprocess.run(
            ["az", "account", "list", "--output", "json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode != 0:
            print(f"Error: {result.stderr}")
            return None

        return result.stdout

    def scp(self, source, destination, ssh_key, path):
        # scp files
        Log.info(f'Launch scp {source} -> {destination}')
        scp_command = f"scp -o StrictHostKeyChecking=no -i {ssh_key}"
        command = f'{scp_command} {source} {destination}'
        self.run_shell(command, path)

    def rsync(self, source, destination, ssh_key, exclude=True):
        # rsync = f'rsync -a --exclude-from='.gitignore' -e "ssh -o 'StrictHostKeyChecking no' -i $CURRENT_DIR/ad/$lab/providers/$provider/ssh_keys/ubuntu-jumpbox.pem" "$CURRENT_DIR/" goad@$public_ip:~/GOAD/'
        Log.info(f'Launch Rsync {source} -> {destination}')
        ssh_command = f"ssh -o StrictHostKeyChecking=no -i {ssh_key}"
        exclude_from = ''
        if exclude:
            exclude_from = '--exclude-from=".gitignore"'
        command = f'rsync -a {exclude_from} -e "{ssh_command}" {source} {destination}'
        self.run_shell(command, source)

```

### Core Architecture Module: `goad/command/cmd_factory.py`
```
from goad.command.windows import WindowsCommand
from goad.command.linux import LinuxCommand
from goad.command.wsl import WslCommand
from goad.utils import Utils


class CommandFactory:

    @staticmethod
    def get_command():
        if Utils.is_wsl():
            return WslCommand()
        elif Utils.is_windows():
            return WindowsCommand()
        return LinuxCommand()

```

### Core Architecture Module: `goad/command/linux.py`
```
import sys
import os
from goad.command.cmd import Command
import subprocess

from goad.goadpath import GoadPath
from goad.log import Log
from goad.utils import Utils


class LinuxCommand(Command):

    def __init__(self):
        super().__init__()
        self.vagrant_bin = 'vagrant'
        self.terraform_bin = 'terraform'

    # CHECK
    def check_gem(self, gem_name):
        try:
            result = subprocess.run(['gem', 'list'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if gem_name in result.stdout:
                Log.success(f'ruby gem {gem_name} is installed')
                return True
            else:
                Log.warning(f'ruby gem {gem_name} not installed')
                return False
        except FileNotFoundError:
            Log.error("Ruby or gem is not installed or not found in PATH.")
            return False

    def check_vmware(self):
        return self.is_in_path('vmrun')

    def check_vmware_utility(self):
        try:
            result = subprocess.run(
                ['systemctl', 'is-active', '--quiet', 'vagrant-vmware-utility'],
                check=True
            )
            Log.success(f'vmware utility is installed')
            return True
        except subprocess.CalledProcessError:
            Log.error("vagrant-vmware-utility is not installed")
            return False

    def check_ovftool(self):
        try:
            result = subprocess.run(['ovftool', '-v'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd='.')
            fields = result.stdout.split(' ')
            if len(fields) > 2:
                version = fields[2]
                Log.success(f'Ovftool version {version} is installed')
                return True
            else:
                Log.error(f'Failed to parse ovftool version')
                return False
        except FileNotFoundError:
            Log.error("ovftool is not installed or not found in PATH.")
            return False

    def check_virtualbox(self):
        return self.is_in_path('VBoxManage')

    def check_ludus(self):
        return self.is_in_path('ludus')

    # RUN
    def run_ludus(self, args, path, api_key, user_id='', impersonation=False):
        env = os.environ.copy()
        if "LUDUS_API_KEY" not in os.environ:
            Log.info('Using api key from config file')
            env["LUDUS_API_KEY"] = api_key
        else:
            Log.info('Using api key from env')
        result = None
        try:
            command = 'ludus '
            if impersonation:
                command += f'--user {user_id} '
            command += args
            Log.info('CWD: ' + Utils.get_relative_path(str(path)))
            Log.cmd(command)
            result = subprocess.run(command, cwd=path, stderr=sys.stderr, stdout=sys.stdout, shell=True, env=env)
        except subprocess.CalledProcessError as e:
            Log.error(f"An error occurred while running the command: {e}")
        return result.returncode == 0

    def run_ludus_result(self, command, path, api_key, do_log=True, user_id='', impersonation=False):
        result = None
        env = os.environ.copy()
        if "LUDUS_API_KEY" not in os.environ:
            Log.info('Using api key from config file')
            env["LUDUS_API_KEY"] = api_key
        else:
            Log.info('Using api key from env')
        try:
            cmd = ['ludus']
            if impersonation:
                cmd += ['--user', user_id]
            cmd += command
            if do_log:
                Log.info('CWD: ' + Utils.get_relative_path(str(path)))
                Log.cmd(' '.join(cmd))
            result = subprocess.run(cmd, cwd=path,
                                    stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE,
                                    text=True,
                                    env=env
                                    )
            if result.returncode != 0:
                print(f"Error: {result.stderr}")
                return None

            return result.stdout
        except subprocess.CalledProcessError as e:
            Log.error(f"An error occurred while running the command: {e}")
        return None

    def run_docker_ansible(self, args, path, ansible_path, sudo):
        result = None
        try:
            ansible_command = 'ansible-playbook '
            ansible_command += args
            command = f"{sudo} docker run -ti --rm --network host -h goadansible -v {GoadPath.get_project_path()}:/goad -w {ansible_path} goadansible /bin/bash -c '{ansible_command}'"
            Log.cmd(command)
            result = subprocess.run(command, cwd=path, stderr=sys.stderr, stdout=sys.stdout, shell=True)
        except subprocess.CalledProcessError as e:
            Log.error(f"An error occurred while running the command: {e}")
            return False
        return result.returncode == 0


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #285** (2024-10-26): **NHA -  permission denied while trying to connect to the Docker daemon socket**
  *Symptoms*: Hi there. There is an issue when trying to execute `./goad_docker.sh` script without using sudo command. if **./goad_docker.sh** script is executed alone, script is able to see that current user is not part of Docker group and requests for credentials, but it seems like even tho you put the password, it is not used later on to execute Docker and the script fails.  It only works if we execute the script with sudo: `sudo ./goad_docker.sh` ![2024-10-21_23-42](https://github.com/user-attachments/assets/37dbd035-1e22-48eb-a06f-07b8f7c57a6f) 
  **Post-Mortem & Fix Analysis**:
  > ok should be fixed now ;) 

- **Issue #281** (2024-12-18): **Not working - Windows  - [-] 3 fails abort. [-] Something wrong during the provisioning task : build.yml - VMWARE**
  *Symptoms*: GOAD-Light/vmware/vm/192.168.56.X (048df9-goad-light-vmware) > install [*] Launch providing [*] CWD: \workspace\048df9-goad-light-vmware\provider [*] Running command : vagrant.exe up Bringing machine 'GOAD-Light-DC01' up with 'vmware_desktop' provider... Bringing machine 'GOAD-Light-DC02' up with 'vmware_desktop' provider... Bringing machine 'GOAD-Light-SRV02' up with 'vmware_desktop' provider... Bringing machine 'PROVISIONING' up with 'vmware_desktop' provider... ==> GOAD-Light-DC01: Checking if box 'StefanScherer/windows_2019' version '2021.05.15' is up to date... ==> GOAD-Light-DC01: Machine is already running. ==> GOAD-Light-DC02: Checking if box 'StefanScherer/windows_2019' version '2021.05.15' is up to date... ==> GOAD-Light-DC02: Machine is already running. ==> GOAD-Light-SRV02: Checking if box 'StefanScherer/windows_2019' version '2021.05.15' is up to date... ==> GOAD-Light-SRV02: Machine is already running. ==> PROVISIONING: Checking if box 'bento/ubuntu-22.04' version '202309.08.0' is up to date... ==> PROVISIONING: Machine is already running. [*] Prepare jumpbox if needed [*] Launch scp C:\Users\feder\Downloads\GOAD\scripts\setup_local_jumpbox.sh -> vagrant@192.168.56.3:~/setup.sh [*] CWD: \workspace\048df9-goad-light-vmware [*] Running command : scp -o StrictHostKeyChecking=no -i C:\Users\feder\Downloads\GOAD\workspace\048df9-goad-light-vmware\provider\.vagrant\machines\PROVISIONING\vmware_desktop\ private_key C:\Users\feder\Downloads\GOAD\scr
  **Post-Mortem & Fix Analysis**:
  > you can now retry : ``` ./goad.sh > cd 048df9-goad-light-vmware (048df9-goad-light-vmware) > install ```  and tell me if it's ok now :)
  > HI , I have the same issue, but  after I do git merge update and reinstall, the problem is still there. I check the host machine (my windows). It does not have route to 192.168.56.0/24. By the way, I found need to use administrator to install. 
  > > HI , I have the same issue, but after I do git merge update and reinstall, the problem is still there. I check the host machine (my windows). It does not have route to 192.168.56.0/24. By the way, I found need to use administrator to install.  I achieved partial success. My first installation attempt was unsuccessful (because I didn't use administrative privileges). At that time, vmnet2 had already been set up, but there was no DHCP. I reconfigured VMware's vmnet2 network to use DHCP, and after that, the script was able to log in and execute commands.

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

### Incident Patch 1: `7ae54d16` (2026-03-12)
**Commit Message**: fix compatibility

**File**: `goad/command/cmd.py` (modified, +8/-3)
```diff
@@ -12,14 +12,16 @@ def __init__(self):
         self.terraform_bin = ''
 
     # CHECK
-    def is_in_path(self, bin_file):
+    def is_in_path(self, bin_file, show_log=True):
         command = f'which {bin_file} >/dev/null'
         try:
             subprocess.run(command, shell=True, check=True)
-            Log.success(f'{bin_file} found in PATH')
+            if show_log:
+                Log.success(f'{bin_file} found in PATH')
             return True
         except subprocess.CalledProcessError as e:
-            Log.error(f'{bin_file} not found in PATH')
+            if show_log:
+                Log.error(f'{bin_file} not found in PATH')
             return False
 
     def check_vagrant(self):
@@ -178,6 +180,9 @@ def run_terraform_output(self, args, path):
             Log.error(f"An error occurred while running the command: {e}")
         return None
 
+    def on_ludus(self):
+        return self.is_in_path('ludus', False)
+
     def run_ludus(self, args, path, api_key, user_id='', impersonation=False):
         # linux only
         pass
```

**File**: `goad/provider/ludus/ludus.py` (modified, +11/-10)
```diff
@@ -15,16 +15,17 @@ def _get_ludus_major_version(config):
         return int(os.environ['LUDUS_VERSION'])
     api_key = config.get_value('ludus', 'ludus_api_key', 'not_set')
     command = CommandFactory.get_command()
-    output = command.run_ludus_result(['version', '--json'], None, api_key, do_log=False)
-    if not output:
-        return 1
-    try:
-        version_json = json.loads(output)
-        version = version_json.get('version', '')
-        if version:
-            return int(version.split('.')[0])
-    except (json.JSONDecodeError, KeyError, ValueError):
-        pass
+    if command.on_ludus():
+        output = command.run_ludus_result(['version', '--json'], None, api_key, do_log=False)
+        if not output:
+            return 1
+        try:
+            version_json = json.loads(output)
+            version = version_json.get('version', '')
+            if version:
+                return int(version.split('.')[0])
+        except (json.JSONDecodeError, KeyError, ValueError):
+            pass
     return 1
 
 
```

---

### Incident Patch 2: `2c39dc9a` (2026-03-11)
**Commit Message**: fix(ludus): 🐛 fix SSH options to not store host keys; allows duplicate builds on the same IP range (i.e. destroy then rebuild)

Signed-off-by: kernel-sanders <[REDACTED_EMAIL]>

**File**: `ad/DRACARYS/providers/ludus/inventory` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 ; ------------------------------------------------
 dc01 ansible_host={{ip_range}}.10 dns_domain=dc01 dict_key=dc01
 srv01 ansible_host={{ip_range}}.11 dns_domain=dc01 dict_key=srv01
-lx01 ansible_host={{ip_range}}.12  dict_key=lx01 ansible_connection=ssh ansible_ssh_common_args='-o StrictHostKeyChecking=no'
+lx01 ansible_host={{ip_range}}.12 dict_key=lx01 ansible_connection=ssh ansible_ssh_common_args='-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'
 
 [all:vars]
 force_dns_server=no
```

---

### Incident Patch 3: `1ba51a1f` (2026-03-10)
**Commit Message**: fix(ludus): 🐛 refactor ludus provider for less code re-use and better version checking

Signed-off-by: kernel-sanders <[REDACTED_EMAIL]>

**File**: `goad/provider/ludus/ludus.py` (modified, +261/-24)
```diff
@@ -1,34 +1,271 @@
-"""Ludus provider router: detects Ludus version and delegates to the correct implementation."""
-
-import re
+from goad.provider.provider import Provider
 from goad.command.cmd_factory import CommandFactory
-from goad.log import Log
 from goad.utils import *
+from goad.log import Log
+import json
+import time
 
 
 def _get_ludus_major_version(config):
-    """Run `ludus version` and return the major version number (1 or 2). Defaults to 1 on failure or the value of LUDUS_VERSION environment variable."""
+    """Run `ludus version` and return the major version number (1 or 2).
+
+    Falls back to the LUDUS_VERSION env var, then defaults to 1.
+    """
     if 'LUDUS_VERSION' in os.environ:
         return int(os.environ['LUDUS_VERSION'])
-    # THERE is a regression with that on other providers so fallback to export LUDUS_VERSION=2 for v2
-    # api_key = config.get_value('ludus', 'ludus_api_key', 'not_set')
-    # command = CommandFactory.get_command()
-    # ## Version command does not require a lab path; cwd=None uses current directory
-    # output = command.run_ludus_result(['version'], None, api_key, do_log=False)
-    # if not output:
-    #     return 1
-    # # Match first digit sequence (e.g. "1.2.3", "v2.0.0", "Version: 2.0.0")
-    # match = re.search(r'(\d+)\.(\d+)\.(\d+)', output)
-    # if match:
-    #     return int(match.group(1))
+    api_key = config.get_value('ludus', 'ludus_api_key', 'not_set')
+    command = CommandFactory.get_command()
+    output = command.run_ludus_result(['version', '--json'], None, api_key, do_log=False)
+    if not output:
+        return 1
+    try:
+        version_json = json.loads(output)
+        version = version_json.get('version', '')
+        if version:
+            return int(version.split('.')[0])
+    except (json.JSONDecodeError, KeyError, ValueError):
+        pass
     return 1
 
 
-def get_ludus_provider(lab_name, config):
-    """Return the appropriate Ludus provider instance for the installed Ludus version."""
-    major = _get_ludus_major_version(config)
-    if major == 2:
-        from goad.provider.ludus.ludus2 import Ludus2Provider
-        return Ludus2Provider(lab_name, config)
-    from goad.provider.ludus.ludus1 import Ludus1Provider
-    return Ludus1Provider(lab_name, config)
+class LudusProvider(Provider):
+    provider_name = LUDUS
+    default_provisioner = PROVISIONING_LOCAL
+    allowed_provisioners = [PROVISIONING_LOCAL, PROVISIONING_RUNNER]
+    update_ip_range = True
+
+    def __init__(self, lab_name, config):
+        super().__init__(lab_name)
+        self.api_key = config.get_value('ludus', 'ludus_api_key', 'not_set')
+        self.use_impersonation = config.get_value('ludus', 'use_impersonation', 'no') == 'yes'
+        self.lab_user = 'GOAD'
+        self.major_version = _get_ludus_major_version(config)
+
+    def _user_command(self, args):
+        """Build a user-related command list, adding the v1 URL prefix when needed."""
+        if self.major_version < 2:
+            return ['--url', 'https://127.0.0.1:8081'] + args
+        return args
+
+    def set_lab_user(self, lab_user):
+        if self.use_impersonation:
+            self.lab_user = lab_user
+
+    def get_ludus_user(self):
+        ludus_user = None
+        ludus_version = self.command.run_ludus_result(["version"], self.path, self.api_key)
+        if ludus_version is None:
+            Log.error('Error to contact ludus.')
+            return None
+        if 'No API key loaded' in ludus_version:
+            Log.error('Please add the ludus api key to HOME/.goad/goad.ini file')
+        else:
+            Log.success('Api key is set')
+            if self.use_impersonation:
+                command = self._user_command(['user', 'list', '--json'])
+                ludus_users = self.command.run_ludus_result(command, self.path, self.api_key)
+                print(ludus_users)
+                users = json.loads(ludus_users)
+                if len(users) > 0:
+                    Log.info(f'Current user name : {users[0]["name"]}')
+                    Log.info(f'Current user ID   : {users[0]["userID"]}')
+                    Log.info(f'User is admin     : {users[0]["isAdmin"]}')
+                    if not users[0]["isAdmin"]:
+                        Log.error('User must be admin')
+                    else:
+                        ludus_user = users[0]["userID"]
+            else:
+                ludus_user = 'ok'
+        return ludus_user
+
+    def check(self):
+        Log.info(f"Using Ludus {self.major_version} provider")
+        check = super().check()
+        check_ludus = self.command.check_ludus()
+        if check_ludus:
+            current_ludus_user = self.get_ludus_user()
+            if current_ludus_user is not None:
+                check_ludus = True
+
+        checks = [
+            self.command.check_disk(),
+            self.command.check_ram(),
+            self.command.check_ansible()
+        ]
+      
```

**File**: `goad/provider/ludus/ludus1.py` (removed, +0/-173)
```diff
@@ -1,173 +0,0 @@
-from goad.provider.provider import Provider
-from goad.utils import *
-from goad.log import Log
-import json
-import time
-
-
-class Ludus1Provider(Provider):
-    provider_name = LUDUS
-    default_provisioner = PROVISIONING_LOCAL
-    allowed_provisioners = [PROVISIONING_LOCAL, PROVISIONING_RUNNER]
-    update_ip_range = True
-
-    def __init__(self, lab_name, config):
-        super().__init__(lab_name)
-        self.api_key = config.get_value('ludus', 'ludus_api_key', 'not_set')
-        if config.get_value('ludus', 'use_impersonation', 'no') == 'yes':
-            self.use_impersonation = True
-        else:
-            self.use_impersonation = False
-        self.lab_user = 'GOAD'
-
-    def set_lab_user(self, lab_user):
-        # user is <LAB>-<randomid>
-        if self.use_impersonation:
-            self.lab_user = lab_user
-
-    def get_ludus_user(self):
-        ludus_user = None
-        ludus_version = self.command.run_ludus_result(["version"], self.path, self.api_key)
-        if ludus_version is None:
-            Log.error('Error to contact ludus.')
-            return None
-        if 'No API key loaded' in ludus_version:
-            Log.error('Please add the ludus api key to HOME/.goad/goad.ini file')
-        else:
-            Log.success('Api key is set')
-            if self.use_impersonation:
-                command = ['--url', 'https://127.0.0.1:8081', 'user', 'list', '--json']
-                ludus_users = self.command.run_ludus_result(command, self.path, self.api_key)
-                print(ludus_users)
-                users = json.loads(ludus_users)
-                if len(users) > 0:
-                    Log.info(f'Current user name : {users[0]["name"]}')
-                    Log.info(f'Current user ID   : {users[0]["userID"]}')
-                    Log.info(f'User is admin     : {users[0]["isAdmin"]}')
-                    if not users[0]["isAdmin"]:
-                        Log.error('User must be admin')
-                    else:
-                        ludus_user = users[0]["userID"]
-            else:
-                ludus_user = 'ok'
-        return ludus_user
-
-    def check(self):
-        Log.info("Using Ludus 1 provider")
-        check = super().check()
-        check_ludus = self.command.check_ludus()
-        if check_ludus:
-            current_ludus_user = self.get_ludus_user()
-            if current_ludus_user is not None:
-                check_ludus = True
-
-        checks = [
-            self.command.check_disk(),
-            self.command.check_ram(),
-            self.command.check_ansible()
-        ]
-        return check and check_ludus and all(checks)
-
-    def user_exist(self, user_to_test):
-        user_exist = False
-        command = ['--url', 'https://127.0.0.1:8081', 'user', 'list', 'all', '--json']
-        ludus_users = self.command.run_ludus_result(command, self.path, self.api_key)
-        users = json.loads(ludus_users)
-        for user in users:
-            if user['userID'] == user_to_test:
-                Log.success(f'User {user_to_test} already exist')
-                user_exist = True
-                break
-        return user_exist
-
-    def install(self):
-        current_ludus_user = ''
-        if self.use_impersonation:
-            # check current ludus user
-            current_ludus_user = self.get_ludus_user()
-            if current_ludus_user is None:
-                return False
-
-            # check ludus user exist
-            if not self.user_exist(self.lab_user):
-                Log.info('Lab user does not exist create it')
-                command = ['--url', 'https://127.0.0.1:8081', 'user', 'add', '-n', self.lab_user, '-i', self.lab_user]
-                user_creation = self.command.run_ludus_result(command, self.path, self.api_key)
-                Log.info('Lab user created')
-
-            if not self.user_exist(self.lab_user):
-                Log.error('Lab user creation error')
-                return False
-
-        set_config_result = self.command.run_ludus(f'range config set -f config.yml', self.path, self.api_key, self.lab_user, self.use_impersonation)
-        if not set_config_result:
-            return False
-
-        deploy_result = self.command.run_ludus(f'range deploy', self.path, self.api_key, self.lab_user, self.use_impersonation)
-        if not deploy_result:
-            return False
-
-        while True:
-            command = ['range', 'status', '--json']
-            ludus_status = self.command.run_ludus_result(command, self.path, self.api_key, do_log=False, user_id=self.lab_user, impersonation=self.use_impersonation)
-            if ludus_status is None:
-                return False
-            try:
-                range_status = json.loads(ludus_status)
-                range_state = range_status['rangeState']
-                if range_state == 'ERROR':
-                    Log.error('Error during deployment')
-                    self.comm
```

**File**: `goad/provider/ludus/ludus2.py` (removed, +0/-184)
```diff
@@ -1,184 +0,0 @@
-from goad.provider.provider import Provider
-from goad.utils import *
-from goad.log import Log
-import json
-import time
-
-
-class Ludus2Provider(Provider):
-    provider_name = LUDUS
-    default_provisioner = PROVISIONING_LOCAL
-    allowed_provisioners = [PROVISIONING_LOCAL, PROVISIONING_RUNNER]
-    update_ip_range = True
-
-    def __init__(self, lab_name, config):
-        super().__init__(lab_name)
-        self.api_key = config.get_value('ludus', 'ludus_api_key', 'not_set')
-        if config.get_value('ludus', 'use_impersonation', 'no') == 'yes':
-            self.use_impersonation = True
-        else:
-            self.use_impersonation = False
-        self.lab_user = 'GOAD'
-
-    def set_lab_user(self, lab_user):
-        # user is <LAB>-<randomid>
-        if self.use_impersonation:
-            self.lab_user = lab_user
-
-    def get_ludus_user(self):
-        ludus_user = None
-        ludus_version = self.command.run_ludus_result(["version"], self.path, self.api_key)
-        if ludus_version is None:
-            Log.error('Error to contact ludus.')
-            return None
-        if 'No API key loaded' in ludus_version:
-            Log.error('Please add the ludus api key to HOME/.goad/goad.ini file')
-        else:
-            Log.success('Api key is set')
-            if self.use_impersonation:
-                command = ['user', 'list', '--json']
-                ludus_users = self.command.run_ludus_result(command, self.path, self.api_key)
-                print(ludus_users)
-                users = json.loads(ludus_users)
-                if len(users) > 0:
-                    Log.info(f'Current user name : {users[0]["name"]}')
-                    Log.info(f'Current user ID   : {users[0]["userID"]}')
-                    Log.info(f'User is admin     : {users[0]["isAdmin"]}')
-                    if not users[0]["isAdmin"]:
-                        Log.error('User must be admin')
-                    else:
-                        ludus_user = users[0]["userID"]
-            else:
-                ludus_user = 'ok'
-        return ludus_user
-
-    def check(self):
-        Log.info("Using Ludus 2 provider")
-        check = super().check()
-        check_ludus = self.command.check_ludus()
-        if check_ludus:
-            current_ludus_user = self.get_ludus_user()
-            if current_ludus_user is not None:
-                check_ludus = True
-
-        checks = [
-            self.command.check_disk(),
-            self.command.check_ram(),
-            self.command.check_ansible()
-        ]
-        return check and check_ludus and all(checks)
-
-    def user_exist(self, user_to_test):
-        user_exist = False
-        command = ['user', 'list', 'all', '--json']
-        ludus_users = self.command.run_ludus_result(command, self.path, self.api_key)
-        users = json.loads(ludus_users)
-        for user in users:
-            if user['userID'] == user_to_test:
-                Log.success(f'User {user_to_test} already exist')
-                user_exist = True
-                break
-        return user_exist
-
-    def install(self):
-        current_ludus_user = ''
-        if self.use_impersonation:
-            # check current ludus user
-            current_ludus_user = self.get_ludus_user()
-            if current_ludus_user is None:
-                return False
-
-            # check ludus user exist
-            if not self.user_exist(self.lab_user):
-                Log.info('Lab user does not exist create it')
-                # Create a random password
-                password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
-                command = ['user', 'add', '-n', self.lab_user, '-i', self.lab_user, '-e', f'{self.lab_user}@ludus.internal', '-p', password]
-                user_creation = self.command.run_ludus_result(command, self.path, self.api_key)
-                Log.info('Lab user created')
-
-            if not self.user_exist(self.lab_user):
-                Log.error('Lab user creation error')
-                return False
-
-        set_config_result = self.command.run_ludus(f'range config set -f config.yml', self.path, self.api_key, self.lab_user, self.use_impersonation)
-        if not set_config_result:
-            return False
-
-        deploy_result = self.command.run_ludus(f'range deploy', self.path, self.api_key, self.lab_user, self.use_impersonation)
-        if not deploy_result:
-            return False
-
-        while True:
-            command = ['range', 'status', '--json']
-            ludus_status = self.command.run_ludus_result(command, self.path, self.api_key, do_log=False, user_id=self.lab_user, impersonation=self.use_impersonation)
-            if ludus_status is None:
-                return False
-            try:
-                range_status = json.loads(ludus_status)
-                range_state = range_status['rangeState']
-                if range_state == 'ERRO
```

**File**: `goad/provider/provider_factory.py` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@
 if Dependencies.proxmox_enabled:
     from goad.provider.terraform.proxmox import ProxmoxProvider
 if Dependencies.ludus_enabled:
-    from goad.provider.ludus.ludus import get_ludus_provider
+    from goad.provider.ludus.ludus import LudusProvider
 
 
 class ProviderFactory:
@@ -35,5 +35,5 @@ def get_provider(provider_name, lab_name, config):
         elif provider_name == AWS and Dependencies.aws_enabled:
             provider = AwsProvider(lab_name, config)
         elif provider_name == LUDUS and Dependencies.ludus_enabled:
-            provider = get_ludus_provider(lab_name, config)
+            provider = LudusProvider(lab_name, config)
         return provider
```

---

### Incident Patch 4: `ff467788` (2026-03-10)
**Commit Message**: fix doc for ludus v2

**File**: `docs/mkdocs/docs/providers/ludus.md` (modified, +3/-0)
```diff
@@ -12,6 +12,9 @@
     To add GOAD on Ludus please use goad directly on the server.
     By now goad can work only directly on the server and not from a workstation client.
 
+!!! info "V2"
+    for ludus v2 create an environment variable : `export LUDUS_VERSION=2`
+
 - Install Ludus : [https://docs.ludus.cloud/docs/quick-start/install-ludus/](https://docs.ludus.cloud/docs/quick-start/install-ludus/)
 
 - Be sure to create an **admin** user and keep his api key
```

**File**: `docs/mkdocs/docs/references.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
 
 - NHA WriteUp :
     - [crypt0ace's blog NHA writeup](https://crypt0ace.github.io/posts/NHA-Part-1/)
-    - [mr-stark's blog NHA writeup](https://mr-stark.notion.site/NINJA-HACKER-ACADEMY-12179e9ad7c980c4a3b7c35e03cd501f)
+    - [mr-stark's blog NHA writeup](https://www.notion.so/mr-stark/NINJA-HACKER-ACADEMY-30c79e9ad7c98066a0f9f8c4c0892be5)
 
 - Podcast
     - [Hackn'speak episode 0x1B (FR)](https://podcasts-francais.fr/podcast/hack-n-speak)
```

---

### Incident Patch 5: `ba8ef63a` (2026-03-10)
**Commit Message**: fix ludus v2 fix regression

**File**: `goad/provider/ludus/ludus.py` (modified, +11/-10)
```diff
@@ -10,16 +10,17 @@ def _get_ludus_major_version(config):
     """Run `ludus version` and return the major version number (1 or 2). Defaults to 1 on failure or the value of LUDUS_VERSION environment variable."""
     if 'LUDUS_VERSION' in os.environ:
         return int(os.environ['LUDUS_VERSION'])
-    api_key = config.get_value('ludus', 'ludus_api_key', 'not_set')
-    command = CommandFactory.get_command()
-    # Version command does not require a lab path; cwd=None uses current directory
-    output = command.run_ludus_result(['version'], None, api_key, do_log=False)
-    if not output:
-        return 1
-    # Match first digit sequence (e.g. "1.2.3", "v2.0.0", "Version: 2.0.0")
-    match = re.search(r'(\d+)\.(\d+)\.(\d+)', output)
-    if match:
-        return int(match.group(1))
+    # THERE is a regression with that on other providers so fallback to export LUDUS_VERSION=2 for v2
+    # api_key = config.get_value('ludus', 'ludus_api_key', 'not_set')
+    # command = CommandFactory.get_command()
+    # ## Version command does not require a lab path; cwd=None uses current directory
+    # output = command.run_ludus_result(['version'], None, api_key, do_log=False)
+    # if not output:
+    #     return 1
+    # # Match first digit sequence (e.g. "1.2.3", "v2.0.0", "Version: 2.0.0")
+    # match = re.search(r'(\d+)\.(\d+)\.(\d+)', output)
+    # if match:
+    #     return int(match.group(1))
     return 1
 
 
```

---

### Incident Patch 6: `9df56171` (2026-03-05)
**Commit Message**: fix bot and disable vagrant

**File**: `ad/DRACARYS/data/inventory_disable_vagrant` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 ; ------------------------------------------------
 dc01 ansible_host={{ip_range}}.10 dns_domain=dc01 dict_key=dc01 ansible_user=drogon@dracarys.lab ansible_password=sUIjHxs1i0yxZsGBreh0
 srv01 ansible_host={{ip_range}}.11 dns_domain=dc01 dict_key=srv01 ansible_user=drogon@dracarys.lab ansible_password=sUIjHxs1i0yxZsGBreh0
-lx01 ansible_host={{ip_range}}.12  dict_key=lx01 ansible_connection=ssh ansible_ssh_common_args='-o StrictHostKeyChecking=no' ansible_user=drogon@dracarys.lab ansible_password=sUIjHxs1i0yxZsGBreh0
+lx01 ansible_host={{ip_range}}.12  dict_key=lx01 ansible_connection=ssh ansible_ssh_common_args='-o StrictHostKeyChecking=no' ansible_user=drogon ansible_password=sUIjHxs1i0yxZsGBreh0
 
 [all:vars]
 ; domain_name : folder inside ad/
```

**File**: `ad/DRACARYS/files/srv01/bot_ssh.ps1` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-$User = "viserion@dracarys.lab"
+$User = "viserion"
 $SSHHost = "syrax"
 $Password = "aLHtz1WvIVmeV4Zh4CDE"
 
```

---

### Incident Patch 7: `95f676f6` (2026-03-05)
**Commit Message**: fix time errors

**File**: `ansible/roles/linux/add_linux_to_domain/handlers/main.yml` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
     name: sssd
     state: restarted
 
-- name: Restart timesyncd
+- name: Restart chrony
   ansible.builtin.systemd:
-    name: systemd-timesyncd
+    name: chrony
     state: restarted
\ No newline at end of file
```

**File**: `ansible/roles/linux/add_linux_to_domain/tasks/main.yml` (modified, +42/-10)
```diff
@@ -192,20 +192,52 @@
   ansible.builtin.command:
     cmd: "ntpdate -u {{ dc_ip }}"
 
-- name: Ensure systemd-timesyncd is enabled
-  ansible.builtin.systemd:
-    name: systemd-timesyncd
-    enabled: yes
-    state: started
+- name: Install chrony
+  ansible.builtin.apt:
+    name: chrony
+    state: present
+    update_cache: yes
 
-- name: Configure systemd-timesyncd to use DC
+- name: Configure DC as NTP server
   ansible.builtin.lineinfile:
-    path: /etc/systemd/timesyncd.conf
-    regexp: '^NTP='
-    line: "NTP={{ dc_ip }}"
+    path: /etc/chrony/chrony.conf
+    regexp: '^server {{ dc_ip }}'
+    line: "server {{ dc_ip }} iburst"
     state: present
+    insertafter: EOF
+  notify:
+    - Restart chrony
+
+- name: Remove default Ubuntu NTP pools
+  ansible.builtin.replace:
+    path: /etc/chrony/chrony.conf
+    regexp: '^pool .*$'
+    replace: ''
   notify:
-    - Restart timesyncd
+    - Restart chrony
+
+- name: Set makestep to 1 -1
+  ansible.builtin.lineinfile:
+    path: /etc/chrony/chrony.conf
+    regexp: '^makestep'
+    line: "makestep 1 -1"
+    state: present
+  notify:
+    - Restart chrony
+
+- name: Ensure chrony is started and enabled
+  ansible.builtin.systemd:
+    name: chrony
+    state: started
+    enabled: yes
+
+- name: Set RTC in local timezone and adjust system clock
+  ansible.builtin.command:
+    cmd: timedatectl set-local-rtc 1 --adjust-system-clock
+
+- name: Force immediate time sync
+  ansible.builtin.command:
+    cmd: chronyc -a makestep
 
 - name: Remove faulty ad_server line to enable auto-discovery
   lineinfile:
```

---

### Incident Patch 8: `83186cdc` (2026-03-05)
**Commit Message**: fix box version

**File**: `ad/DRACARYS/providers/virtualbox/Vagrantfile` (modified, +2/-1)
```diff
@@ -18,7 +18,8 @@ boxes =
   },
   { :name => "DRACARYS-LX01",
     :ip => "{{ip_range}}.12",
-    :box => "bento/ubuntu-24.04", 
+    :box => "bento/ubuntu-24.04",
+    :box_version => "202510.26.0",
     :os => "linux",
     :cpus => 2,
     :mem => 3000,
```

**File**: `ad/DRACARYS/providers/vmware/Vagrantfile` (modified, +2/-1)
```diff
@@ -18,7 +18,8 @@ boxes =
   },
   { :name => "DRACARYS-LX01",
     :ip => "{{ip_range}}.12",
-    :box => "bento/ubuntu-24.04", 
+    :box => "bento/ubuntu-24.04",
+    :box_version => "202510.26.0",
     :os => "linux",
     :cpus => 2,
     :mem => 3000,
```

---

### Incident Patch 9: `a2072076` (2026-03-04)
**Commit Message**: fix gssapi error

**File**: `ansible/roles/linux/add_linux_to_domain/handlers/main.yml` (modified, +5/-0)
```diff
@@ -1,4 +1,9 @@
 - name: Restart SSH
   service:
     name: ssh
+    state: restarted
+
+- name: Restart SSSD
+  systemd:
+    name: sssd
     state: restarted
\ No newline at end of file
```

**File**: `ansible/roles/linux/add_linux_to_domain/tasks/main.yml` (modified, +9/-0)
```diff
@@ -175,3 +175,12 @@
     dest: /etc/resolv.conf
     state: link
     force: yes
+
+- name: Remove faulty ad_server line to enable auto-discovery
+  lineinfile:
+    path: /etc/sssd/sssd.conf
+    regexp: '^ad_server\s*='
+    state: absent
+    backup: yes
+  notify:
+    - Restart SSSD
\ No newline at end of file
```

---

### Incident Patch 10: `4e9dd982` (2026-03-04)
**Commit Message**: fix dns on linux joined computer

**File**: `ansible/roles/linux/add_linux_to_domain/tasks/main.yml` (modified, +8/-1)
```diff
@@ -167,4 +167,11 @@
 - name: restart systemd-resolved
   systemd:
     name: systemd-resolved
-    state: restarted
\ No newline at end of file
+    state: restarted
+
+- name: Fix symlink resolv.conf
+  file:
+    src: /run/systemd/resolve/resolv.conf
+    dest: /etc/resolv.conf
+    state: link
+    force: yes
```

---

### Incident Patch 11: `358dc265` (2026-03-03)
**Commit Message**: fix dns on linux joined computer

**File**: `ansible/roles/linux/add_linux_to_domain/tasks/main.yml` (modified, +9/-4)
```diff
@@ -158,8 +158,13 @@
     "sudo realm join --client-software=sssd {{ domain }}"
   ignore_errors: yes
 
-- name: change nameserver ip
+- name: Define domain DNS in resolved.conf
   lineinfile:
-    path: /etc/resolv.conf
-    regexp: '^nameserver '
-    line: "nameserver {{dc_ip}}"
+    path: /etc/systemd/resolved.conf
+    regexp: '^#?DNS='
+    line: "DNS={{dc_ip}}"
+
+- name: restart systemd-resolved
+  systemd:
+    name: systemd-resolved
+    state: restarted
\ No newline at end of file
```

---

### Incident Patch 12: `f49ff138` (2026-03-03)
**Commit Message**: add dns to linux host

**File**: `ansible/roles/linux/add_linux_to_domain/tasks/main.yml` (modified, +6/-0)
```diff
@@ -157,3 +157,9 @@
   shell:
     "sudo realm join --client-software=sssd {{ domain }}"
   ignore_errors: yes
+
+- name: change nameserver ip
+  lineinfile:
+    path: /etc/resolv.conf
+    regexp: '^nameserver '
+    line: "nameserver {{dc_ip}}"
```

---

### Incident Patch 13: `5bba572e` (2026-03-03)
**Commit Message**: add ram on linux vm

**File**: `ad/DRACARYS/providers/ludus/config.yml` (modified, +1/-1)
```diff
@@ -22,6 +22,6 @@ ludus:
     template: ubuntu-24.04-x64-server-template
     vlan: 10
     ip_last_octet: 12
-    ram_gb: 2
+    ram_gb: 4
     cpus: 2
     linux: true
```

**File**: `ad/DRACARYS/providers/proxmox/linux.tf` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
   name               = "LX01"
   desc               = "LX01 - DRACARYS"
   cores              = 2
-  memory             = 2024
+  memory             = 4096
   clone              = "Ubuntu_2404_x64"
   dns                = "{{ip_range}}.1"
   ip                 = "{{ip_range}}.12/24"
```

---

### Incident Patch 14: `9ed51b4e` (2026-03-03)
**Commit Message**: fix disable vagrant

**File**: `ad/DRACARYS/data/inventory_disable_vagrant` (modified, +3/-3)
```diff
@@ -2,9 +2,9 @@
 ; ------------------------------------------------
 ; dracarys.lab
 ; ------------------------------------------------
-dc01 ansible_host={{ip_range}}.10 dns_domain=dc01 dict_key=dc01 ansible_user=administrator@dracarys.lab ansible_password=Ufe-bVXSx9rk
-srv01 ansible_host={{ip_range}}.11 dns_domain=dc01 dict_key=srv01 ansible_user=administrator@dracarys.lab ansible_password=Ufe-bVXSx9rk
-lx01 ansible_host={{ip_range}}.12  dict_key=lx01 ansible_connection=ssh ansible_ssh_common_args='-o StrictHostKeyChecking=no' ansible_user=administrator@dracarys.lab ansible_password=Ufe-bVXSx9rk
+dc01 ansible_host={{ip_range}}.10 dns_domain=dc01 dict_key=dc01 ansible_user=drogon@dracarys.lab ansible_password=sUIjHxs1i0yxZsGBreh0
+srv01 ansible_host={{ip_range}}.11 dns_domain=dc01 dict_key=srv01 ansible_user=drogon@dracarys.lab ansible_password=sUIjHxs1i0yxZsGBreh0
+lx01 ansible_host={{ip_range}}.12  dict_key=lx01 ansible_connection=ssh ansible_ssh_common_args='-o StrictHostKeyChecking=no' ansible_user=drogon@dracarys.lab ansible_password=sUIjHxs1i0yxZsGBreh0
 
 [all:vars]
 ; domain_name : folder inside ad/
```

**File**: `ansible/disable_vagrant.yml` (modified, +1/-0)
```diff
@@ -6,5 +6,6 @@
 
 - name: "Disable vagrant"
   hosts: linux_domain
+  become: yes
   roles:
     - { role: 'linux/disable_user', tags: 'disable_vagrant', username: "vagrant"}
\ No newline at end of file
```

**File**: `ansible/enable_vagrant.yml` (modified, +1/-0)
```diff
@@ -6,5 +6,6 @@
 
 - name: "Disable vagrant"
   hosts: linux_domain
+  become: yes
   roles:
     - { role: 'linux/enable_user', tags: 'enable_user', username: "vagrant"}
\ No newline at end of file
```

---

### Incident Patch 15: `9d061e95` (2026-03-03)
**Commit Message**: fix proxmox windows 2025 usage

**File**: `template/provider/proxmox/windows.tf` (modified, +1/-0)
```diff
@@ -31,6 +31,7 @@ resource "proxmox_virtual_environment_vm" "bgp" {
     cpu {
       cores   = each.value.cores
       sockets = 1
+      type    = "host"
     }
 
     memory {
```

#### Recent Merged Pull Requests:
- **PR #506** (closed): Update inventory - elk (@ghost)
- **PR #505** (closed): Update inventory - wazuh (@ghost)
- **PR #504** (closed): Update inventory - guacamole (@ghost)
- **PR #503** (closed): Update inventory - extension, lx01 (@ghost)
- **PR #499** (closed): Adfs and stuff (@ryokubaka)
- **PR #486** (2026-03-12): Pr/485 (@Mayfly277)
- **PR #485** (2026-03-12): Ludus 2 support refactor (@kernel-sanders)
- **PR #484** (2026-03-10): feat(providers): ✨ add ludus 2 compatibility (@kernel-sanders)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
