function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
export var UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];
function isSafeIdentifierBase(v) {
  if (typeof v !== 'string') return false;
  if (v.length === 0 || v.length > 128) return false;
  if (UNSAFE_KEYS.indexOf(v) > -1) return false;
  if (v.indexOf('..') > -1) return false;
  if (v.indexOf('\\') > -1) return false;
  if (/[\x00-\x1F\x7F]/.test(v)) return false;
  return true;
}
export function isSafeLangIdentifier(v) {
  if (!isSafeIdentifierBase(v)) return false;
  if (v.indexOf('/') > -1) return false;
  return true;
}
export function isSafeNsIdentifier(v) {
  return isSafeIdentifierBase(v);
}
export var isSafeIdentifier = isSafeLangIdentifier;
export function hasUnsafeKeySegment(key, keySeparator) {
  if (typeof key !== 'string') return false;
  if (UNSAFE_KEYS.indexOf(key) > -1) return true;
  if (keySeparator === false) return false;
  var sep = keySeparator || '.';
  if (key.indexOf(sep) < 0) return false;
  var segments = key.split(sep);
  var _iterator = _createForOfIteratorHelper(segments),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var s = _step.value;
      if (UNSAFE_KEYS.indexOf(s) > -1) return true;
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  return false;
}
export function setPath(object, path, newValue) {
  var stack;
  if (typeof path !== 'string') stack = [].concat(path);
  if (typeof path === 'string') stack = path.split('.');
  while (stack.length > 1) {
    var _key = stack.shift();
    if (_key.indexOf('###') > -1) _key = _key.replace(/###/g, '.');
    if (UNSAFE_KEYS.indexOf(_key) > -1) return;
    if (!object[_key]) object[_key] = {};
    object = object[_key];
  }
  var key = stack.shift();
  if (key.indexOf('###') > -1) key = key.replace(/###/g, '.');
  if (UNSAFE_KEYS.indexOf(key) > -1) return;
  object[key] = newValue;
}
var arr = [];
var each = arr.forEach;
var slice = arr.slice;
export function defaults(obj) {
  each.call(slice.call(arguments, 1), function (source) {
    if (source) {
      for (var prop in source) {
        if (obj[prop] === undefined) obj[prop] = source[prop];
      }
    }
  });
  return obj;
}
export function extend(obj) {
  each.call(slice.call(arguments, 1), function (source) {
    if (source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    }
  });
  return obj;
}
export function removeLngFromUrl(url, lookupFromPathIndex) {
  var first = '';
  var pos = lookupFromPathIndex;
  if (url[0] === '/') {
    pos++;
    first = '/';
  }
  var parts = url.split('/');
  parts.splice(pos, 1);
  url = parts.join('/');
  if (url[0] !== '/') url = first + url;
  return url;
}
export function escape(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;').replace(/\\/g, '&#x5C;').replace(/`/g, '&#96;');
}
export function sanitizeHeaderValue(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[\r\n\x00-\x1F\x7F]/g, '');
}
export function hasXSS(input) {
  if (typeof input !== 'string') return false;
  var xssPatterns = [/<\s*script.*?>/i, /<\s*\/\s*script\s*>/i, /<\s*\w+\s+[^>]*?\bon\w+\s*=/i, /javascript\s*:/i, /vbscript\s*:/i, /expression\s*\(/i, /eval\s*\(/i, /alert\s*\(/i, /document\.cookie/i, /document\.write\s*\(/i, /window\.location/i, /innerHTML/i];
  return xssPatterns.some(function (pattern) {
    return pattern.test(input);
  });
}