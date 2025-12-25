(function() {
  var Color, LERP, LERPingSplines, Point, TAU, Vec2, clone,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty,
    slice = [].slice;

  Color = (function() {
    function Color() {}

    Color.hex2rgb = function(h) {
      var arr, l, len, results, value;
      arr = h.length === 4 ? [h[1] + h[1], h[2] + h[2], h[3] + h[3]] : h.length === 7 ? [h[1] + h[2], h[3] + h[4], h[5] + h[6]] : raise("string '" + h + "' is not in '#RGB' or '#RRGGBB' format");
      results = [];
      for (l = 0, len = arr.length; l < len; l++) {
        value = arr[l];
        results.push(parseInt(value, 16) / 255);
      }
      return results;
    };

    Color.rgb2hex = function(r, g, b) {
      return Color.rgbarr2hex([r, g, b]);
    };

    Color.rgbarr2hex = function(arr) {
      var value;
      return "#" + ((function() {
        var l, len, results;
        results = [];
        for (l = 0, len = arr.length; l < len; l++) {
          value = arr[l];
          results.push(parseInt(255 * value, 10).toString(16).padStart(2, '0'));
        }
        return results;
      })()).join('');
    };

    Color.rgb2hsv = function(r, g, b) {
      var d, h, max, min, s, v;
      max = Math.max(r, g, b);
      min = Math.min(r, g, b);
      v = max;
      d = max - min;
      s = (max === 0 ? 0 : d / max);
      if (max === min) {
        h = 0;
      } else {
        h = (function() {
          switch (max) {
            case r:
              return (g - b) / d + (g < b ? 6 : 0);
            case g:
              return (b - r) / d + 2;
            case b:
              return (r - g) / d + 4;
          }
        })();
        h /= 6;
      }
      return [h, s, v];
    };

    Color.hsv2rgb = function(h, s, v) {
      var f, i, p, q, t;
      i = Math.floor(h * 6);
      f = h * 6 - i;
      p = v * (1 - s);
      q = v * (1 - f * s);
      t = v * (1 - (1 - f) * s);
      switch (i % 6) {
        case 0:
          return [v, t, p];
        case 1:
          return [q, v, p];
        case 2:
          return [p, v, t];
        case 3:
          return [p, q, v];
        case 4:
          return [t, p, v];
        case 5:
          return [v, p, q];
      }
    };

    return Color;

  })();

  clone = function(obj) {
    var flags, key, newInstance;
    if ((obj == null) || typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    if (obj instanceof RegExp) {
      flags = '';
      if (obj.global != null) {
        flags += 'g';
      }
      if (obj.ignoreCase != null) {
        flags += 'i';
      }
      if (obj.multiline != null) {
        flags += 'm';
      }
      if (obj.sticky != null) {
        flags += 'y';
      }
      return new RegExp(obj.source, flags);
    }
    newInstance = new obj.constructor();
    for (key in obj) {
      newInstance[key] = clone(obj[key]);
    }
    return newInstance;
  };

  Vec2 = (function() {
    function Vec2() {}

    Vec2.lerp = function(a, b, amount) {
      return {
        x: a.x + (amount * (b.x - a.x)),
        y: a.y + (amount * (b.y - a.y))
      };
    };

    Vec2.magnitude = function(v) {
      return Math.sqrt((v.x * v.x) + (v.y * v.y));
    };

    Vec2.scale = function(v, scale) {
      return {
        x: v.x * scale,
        y: v.y * scale
      };
    };

    Vec2.rotate = function(v, angle) {
      var c, s;
      c = Math.cos(angle);
      s = Math.sin(angle);
      return {
        x: (v.x * c) - (v.y * s),
        y: (v.x * s) + (v.y * c)
      };
    };

    Vec2.normalize = function(v) {
      var ilength, length, result;
      result = {
        x: 0.0,
        y: 0.0
      };
      length = Math.sqrt((v.x * v.x) + (v.y * v.y));
      if (length > 0) {
        ilength = 1.0 / length;
        result.x = v.x * ilength;
        result.y = v.y * ilength;
      }
      return result;
    };

    return Vec2;

  })();

  
/* copied from: https://raw.githubusercontent.com/Pomax/bezierinfo/refs/heads/master/js/graphics-element/api/types/matrix.js */

function invert(M) {
  // Copied from http://blog.acipo.com/matrix-inversion-in-javascript/
  // With permission, http://blog.acipo.com/matrix-inversion-in-javascript/#comment-5057289889

  // (1) 'augment' the matrix (left) by the identity (on the right)
  // (2) Turn the matrix on the left into the identity by elemetry row ops
  // (3) The matrix on the right is the inverse (was the identity matrix)
  // There are 3 elemtary row ops:
  // (a) Swap 2 rows
  // (b) Multiply a row by a scalar
  // (c) Add 2 rows

  //if the matrix isn't square: exit (error)
  if (M.length !== M[0].length) {
    console.log("not square");
    return;
  }

  //create the identity matrix (I), and a copy (C) of the original
  var i = 0,
    ii = 0,
    j = 0,
    dim = M.length,
    e = 0,
    t = 0;
  var I = [],
    C = [];
  for (i = 0; i < dim; i += 1) {
    // Create the row
    I[I.length] = [];
    C[C.length] = [];
    for (j = 0; j < dim; j += 1) {
      //if we're on the diagonal, put a 1 (for identity)
      if (i == j) {
        I[i][j] = 1;
      } else {
        I[i][j] = 0;
      }

      // Also, make the copy of the original
      C[i][j] = M[i][j];
    }
  }

  // Perform elementary row operations
  for (i = 0; i < dim; i += 1) {
    // get the element e on the diagonal
    e = C[i][i];

    // if we have a 0 on the diagonal (we'll need to swap with a lower row)
    if (e == 0) {
      //look through every row below the i'th row
      for (ii = i + 1; ii < dim; ii += 1) {
        //if the ii'th row has a non-0 in the i'th col
        if (C[ii][i] != 0) {
          //it would make the diagonal have a non-0 so swap it
          for (j = 0; j < dim; j++) {
            e = C[i][j]; //temp store i'th row
            C[i][j] = C[ii][j]; //replace i'th row by ii'th
            C[ii][j] = e; //repace ii'th by temp
            e = I[i][j]; //temp store i'th row
            I[i][j] = I[ii][j]; //replace i'th row by ii'th
            I[ii][j] = e; //repace ii'th by temp
          }
          //don't bother checking other rows since we've swapped
          break;
        }
      }
      //get the new diagonal
      e = C[i][i];
      //if it's still 0, not invertable (error)
      if (e == 0) {
        return;
      }
    }

    // Scale this row down by e (so we have a 1 on the diagonal)
    for (j = 0; j < dim; j++) {
      C[i][j] = C[i][j] / e; //apply to original matrix
      I[i][j] = I[i][j] / e; //apply to identity
    }

    // Subtract this row (scaled appropriately for each row) from ALL of
    // the other rows so that there will be 0's in this column in the
    // rows above and below this one
    for (ii = 0; ii < dim; ii++) {
      // Only apply to other rows (we want a 1 on the diagonal)
      if (ii == i) {
        continue;
      }

      // We want to change this element to 0
      e = C[ii][i];

      // Subtract (the row above(or below) scaled by e) from (the
      // current row) but start at the i'th column and assume all the
      // stuff left of diagonal is 0 (which it should be if we made this
      // algorithm correctly)
      for (j = 0; j < dim; j++) {
        C[ii][j] -= e * C[i][j]; //apply to original matrix
        I[ii][j] -= e * I[i][j]; //apply to identity
      }
    }
  }

  //we've done all operations, C should be the identity
  //matrix I should be the inverse:
  return I;
}

function multiply(m1, m2) {
  var M = [];
  var m2t = transpose(m2);
  m1.forEach((row, r) => {
    M[r] = [];
    m2t.forEach((col, c) => {
      M[r][c] = row.map((v, i) => col[i] * v).reduce((a, v) => a + v, 0);
    });
  });
  return M;
}

function transpose(M) {
  return M[0].map((col, i) => M.map((row) => row[i]));
}

class Matrix {
  constructor(n, m, data) {
    data = n instanceof Array ? n : data;
    this.data = data ?? [...new Array(n)].map((v) => [...new Array(m)].map((v) => 0));
    this.rows = this.data.length;
    this.cols = this.data[0].length;
  }
  setData(data) {
    this.data = data;
  }
  get(i, j) {
    return this.data[i][j];
  }
  set(i, j, value) {
    this.data[i][j] = value;
  }
  row(i) {
    return this.data[i];
  }
  col(j) {
    var d = this.data,
      col = [];
    for (let r = 0, l = d.length; r < l; r++) {
      col.push(d[r][j]);
    }
    return col;
  }
  multiply(other) {
    return new Matrix(multiply(this.data, other.data));
  }
  invert() {
    return new Matrix(invert(this.data));
  }
  transpose() {
    return new Matrix(transpose(this.data));
  }
}

/*export { Matrix };*/
;

  window.UI || (window.UI = {});

  UI.Option = (function() {
    Option.create_input_element = function(type, id) {
      var el;
      if (type == null) {
        type = null;
      }
      if (id == null) {
        id = null;
      }
      el = window.APP.context.createElement('input');
      if (id != null) {
        el.id = id;
      }
      if (type != null) {
        el.type = type;
      }
      return el;
    };

    function Option(id1, default_value, callback) {
      var stored_value;
      this.id = id1;
      if (default_value == null) {
        default_value = null;
      }
      this.callback = callback != null ? callback : {};
      this.on_input = bind(this.on_input, this);
      this.on_change = bind(this.on_change, this);
      if (this.id instanceof Element) {
        this.el = this.id;
        this.id = this.el.id;
      } else {
        this.el = window.APP.context.getElementById(this.id);
        if (this.el == null) {
          console.log("ERROR - could not find element with id=\"" + this.id + "\"");
        }
      }
      this.persist = true;
      this.storage_id = "ui_option-" + this.id;
      this.label_id = this.id + "_label";
      this.label_el = window.APP.context.getElementById(this.label_id);
      this.label_text_formater = this.default_label_text_formater;
      if (default_value != null) {
        this["default"] = default_value;
      } else {
        this["default"] = this.detect_default_value();
      }
      stored_value = APP.storage_get(this.storage_id);
      if (stored_value != null) {
        this.set(stored_value);
      } else {
        this.set(this["default"]);
      }
      this.setup_listeners();
    }

    Option.prototype.setup_listeners = function() {
      this.el.addEventListener('change', this.on_change);
      return this.el.addEventListener('input', this.on_input);
    };

    Option.prototype.detect_default_value = function() {
      return this.get();
    };

    Option.prototype.reset = function() {
      APP.storage_remove(this.storage_id);
      return this.set(this["default"]);
    };

    Option.prototype.register_callback = function(opt) {
      var func, key, name, ref, results;
      if (opt == null) {
        opt = {};
      }
      for (name in opt) {
        func = opt[name];
        this.callback[name] = func;
      }
      ref = this.callback;
      results = [];
      for (key in ref) {
        func = ref[key];
        if (func == null) {
          results.push(delete this.callback[name]);
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Option.prototype.set_value = function(new_value) {
      if (new_value == null) {
        new_value = null;
      }
      if (new_value != null) {
        this.value = new_value;
      }
      if (this.label_el != null) {
        this.label_el.innerText = this.label_text();
      }
      if (this.persist) {
        return APP.storage_set(this.storage_id, this.value, this["default"]);
      }
    };

    Option.prototype.default_label_text_formater = function(value) {
      return "" + value;
    };

    Option.prototype.label_text = function() {
      return this.label_text_formater(this.value);
    };

    Option.prototype.set_label_text_formater = function(func) {
      this.label_text_formater = func;
      return this.set_value();
    };

    Option.prototype.on_change = function(event) {
      var base;
      this.set(this.get(event.target), false);
      return typeof (base = this.callback).on_change === "function" ? base.on_change(this.value) : void 0;
    };

    Option.prototype.on_input = function(event) {
      var base;
      this.set(this.get(event.target), false);
      return typeof (base = this.callback).on_input === "function" ? base.on_input(this.value) : void 0;
    };

    Option.prototype.enable = function() {
      return this.el.disabled = false;
    };

    Option.prototype.disable = function() {
      return this.el.disabled = true;
    };

    Option.prototype.destroy = function() {
      if (this.el != null) {
        this.el.remove();
      }
      return this.el = null;
    };

    return Option;

  })();

  UI.BoolOption = (function(superClass) {
    extend(BoolOption, superClass);

    function BoolOption() {
      return BoolOption.__super__.constructor.apply(this, arguments);
    }

    BoolOption.create = function() {
      var id1, opt, parent, rest;
      parent = arguments[0], id1 = arguments[1], rest = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      this.id = id1;
      opt = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(UI.BoolOption, [UIOption.create_input_element('checkbox', this.id)].concat(slice.call(rest)), function(){});
      parent.appendChild(opt.el);
      return opt;
    };

    BoolOption.prototype.get = function(element) {
      if (element == null) {
        element = this.el;
      }
      return element.checked;
    };

    BoolOption.prototype.set = function(bool_value, update_element) {
      var base, base1, newvalue, oldvalue;
      if (update_element == null) {
        update_element = true;
      }
      oldvalue = this.value;
      newvalue = (function() {
        switch (bool_value) {
          case 'true':
            return true;
          case 'false':
            return false;
          default:
            return !!bool_value;
        }
      })();
      if (update_element) {
        this.el.checked = newvalue;
      }
      this.set_value(newvalue);
      if (oldvalue !== newvalue) {
        if (newvalue) {
          return typeof (base = this.callback).on_true === "function" ? base.on_true() : void 0;
        } else {
          return typeof (base1 = this.callback).on_false === "function" ? base1.on_false() : void 0;
        }
      }
    };

    return BoolOption;

  })(UI.Option);

  UI.IntOption = (function(superClass) {
    extend(IntOption, superClass);

    function IntOption() {
      return IntOption.__super__.constructor.apply(this, arguments);
    }

    IntOption.create = function() {
      var id1, opt, parent, rest;
      parent = arguments[0], id1 = arguments[1], rest = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      this.id = id1;
      opt = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(UI.IntOption, [UIOption.create_input_element('number', this.id)].concat(slice.call(rest)), function(){});
      parent.appendChild(opt.el);
      return opt;
    };

    IntOption.prototype.get = function(element) {
      if (element == null) {
        element = this.el;
      }
      return parseInt(element.value);
    };

    IntOption.prototype.set = function(number_value, update_element) {
      if (update_element == null) {
        update_element = true;
      }
      this.set_value(parseInt(number_value));
      if (update_element) {
        return this.el.value = this.value;
      }
    };

    return IntOption;

  })(UI.Option);

  UI.FloatOption = (function(superClass) {
    extend(FloatOption, superClass);

    function FloatOption() {
      return FloatOption.__super__.constructor.apply(this, arguments);
    }

    FloatOption.create = function() {
      var id1, opt, parent, rest;
      parent = arguments[0], id1 = arguments[1], rest = 3 <= arguments.length ? slice.call(arguments, 2) : [];
      this.id = id1;
      opt = (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(UI.IntOption, [UIOption.create_input_element(null, this.id)].concat(slice.call(rest)), function(){});
      parent.appendChild(opt.el);
      return opt;
    };

    FloatOption.prototype.get = function(element) {
      if (element == null) {
        element = this.el;
      }
      return parseFloat(element.value);
    };

    FloatOption.prototype.set = function(number_value, update_element) {
      if (update_element == null) {
        update_element = true;
      }
      this.set_value(parseFloat(number_value));
      if (update_element) {
        return this.el.value = this.value;
      }
    };

    return FloatOption;

  })(UI.Option);

  UI.PercentOption = (function(superClass) {
    extend(PercentOption, superClass);

    function PercentOption() {
      return PercentOption.__super__.constructor.apply(this, arguments);
    }

    PercentOption.prototype.label_text = function() {
      var perc;
      perc = parseInt(this.value * 100);
      return perc + "%";
    };

    return PercentOption;

  })(UI.FloatOption);

  UI.SelectOption = (function(superClass) {
    extend(SelectOption, superClass);

    function SelectOption() {
      return SelectOption.__super__.constructor.apply(this, arguments);
    }

    SelectOption.prototype.setup_listeners = function() {
      return this.el.addEventListener('change', this.on_change);
    };

    SelectOption.prototype.get = function(element) {
      var opt;
      if (element == null) {
        element = this.el;
      }
      opt = element.options[element.selectedIndex];
      if (opt != null) {
        return opt.value;
      } else {
        return null;
      }
    };

    SelectOption.prototype.set = function(option_name, update_element) {
      var opt;
      if (update_element == null) {
        update_element = true;
      }
      opt = this.option_with_name(option_name);
      if (opt != null) {
        this.set_value(opt.value);
        if (update_element) {
          return opt.selected = true;
        }
      }
    };

    SelectOption.prototype.values = function() {
      return this.el.options.map(function(x) {
        return x.name;
      });
    };

    SelectOption.prototype.option_with_name = function(name) {
      var l, len, opt, ref;
      ref = this.el.options;
      for (l = 0, len = ref.length; l < len; l++) {
        opt = ref[l];
        if (opt.value === name) {
          return opt;
        }
      }
      return null;
    };

    SelectOption.prototype.add_option = function(value, text, selected) {
      var opt;
      if (selected == null) {
        selected = false;
      }
      opt = document.createElement('option');
      opt.value = value;
      opt.text = text;
      this.el.add(opt, null);
      if (selected) {
        opt.selected = true;
      }
      return this.set(this.get());
    };

    return SelectOption;

  })(UI.Option);

  UI.ColorOption = (function(superClass) {
    extend(ColorOption, superClass);

    function ColorOption() {
      return ColorOption.__super__.constructor.apply(this, arguments);
    }

    ColorOption.prototype.get = function(element) {
      if (element == null) {
        element = this.el;
      }
      return element.value;
    };

    ColorOption.prototype.set = function(new_value, update_element) {
      if (update_element == null) {
        update_element = true;
      }
      this.set_value(new_value);
      if (update_element) {
        this.el.value = new_value;
      }
      return this.color;
    };

    return ColorOption;

  })(UI.Option);

  window.APP = null;

  TAU = 2 * Math.PI;

  Point = (function() {
    function Point(x, y, color1) {
      this.color = color1;
      this.enabled = false;
      this.hover = false;
      this.selected = false;
      this.order = 0;
      this.radius = LERPingSplines.point_radius;
      if (this.color == null) {
        this.color = '#000';
      }
      if (this.label_color == null) {
        this.label_color = '#000';
      }
      this.position = {
        x: x,
        y: y
      };
      this.label_position = {
        x: x,
        y: y
      };
      this.move(x, y);
    }

    Point.prototype.set_label = function(label1) {
      this.label = label1;
      this.label_metrics = APP.graph_ctx.measureText(this.label);
      this.label_width = this.label_metrics.width;
      return this.label_height = LERPingSplines.point_label_height;
    };

    Point.prototype.get_label = function() {
      return this.label;
    };

    Point.prototype.move = function(x, y) {
      this.x = x;
      this.y = y;
      this.ix = Math.floor(this.x);
      return this.iy = Math.floor(this.y);
    };

    Point.prototype.contains = function(x, y) {
      var dist, dx, dy;
      dx = this.x - x;
      dy = this.y - y;
      dist = Math.sqrt((dx * dx) + (dy * dy));
      return dist <= this.radius + LERPingSplines.mouseover_point_radius_boost;
    };

    Point.prototype.update = function(t) {
      this.position.x = this.x;
      this.position.y = this.y;
      this.x_is_left = true;
      if ((this.position.x > (APP.graph_width / 2.0)) && (this.position.x < APP.point_label_flip_margin.max_x)) {
        this.x_is_left = false;
      }
      if (this.position.x <= APP.point_label_flip_margin.min_x) {
        this.x_is_left = false;
      }
      if (this.x_is_left) {
        this.label_position.x = this.position.x - this.label_width - 13;
      } else {
        this.label_position.x = this.position.x + this.label_width - 1;
      }
      this.y_is_top = true;
      if ((this.position.y > (APP.graph_height / 2.0)) && (this.position.y < APP.point_label_flip_margin.max_y)) {
        this.y_is_top = false;
      }
      if (this.position.y <= APP.point_label_flip_margin.min_y) {
        this.y_is_top = false;
      }
      if (this.y_is_top) {
        return this.label_position.y = this.position.y - this.label_height + 2;
      } else {
        return this.label_position.y = this.position.y + this.label_height + 8;
      }
    };

    Point.prototype.draw = function() {
      var ctx;
      if (!this.enabled) {
        return;
      }
      ctx = APP.graph_ctx;
      if (this.hover) {
        ctx.beginPath();
        ctx.fillStyle = '#ff0';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.arc(this.x, this.y, this.radius * 3, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.fillStyle = this.color;
      ctx.arc(this.x, this.y, this.radius, 0, TAU);
      ctx.fill();
      if (this.label) {
        ctx.fillStyle = this.label_color;
        return ctx.fillText(this.label, this.label_position.x, this.label_position.y);
      }
    };

    return Point;

  })();

  LERP = (function(superClass) {
    extend(LERP, superClass);

    function LERP(order1, from, to) {
      this.order = order1;
      this.from = from;
      this.to = to;
      this.enabled = false;
      this.radius = 5;
      this.color = (function() {
        switch (this.order) {
          case 1:
            return '#451C92';
          case 2:
            return '#2D42DC';
          case 3:
            return '#A243DC';
          case 4:
            return '#D44143';
          case 5:
            return '#D98F46';
          case 6:
            return '#70D942';
          case 7:
            return '#6E55FF';
          default:
            return '#555';
        }
      }).call(this);
      this.position = {
        x: this.from.x,
        y: this.from.y
      };
      this.prev_position = {
        x: null,
        y: null
      };
    }

    LERP.prototype.generate_label = function(order, index) {
      this.label = "" + this.from.label + this.to.label;
      return this.alg_label = "temp_" + order + "_" + index;
    };

    LERP.prototype.get_label = function() {
      if (APP.option.alt_algorithm_names) {
        return this.alg_label;
      } else {
        return this.label;
      }
    };

    LERP.prototype.interpolate = function(t, a, b) {
      return (t * b) + ((1 - t) * a);
    };

    LERP.prototype.update = function(t) {
      this.enabled = this.from.enabled && this.to.enabled;
      this.position.x = this.interpolate(t, this.from.position.x, this.to.position.x);
      return this.position.y = this.interpolate(t, this.from.position.y, this.to.position.y);
    };

    LERP.prototype.draw = function() {
      var ctx;
      if (!this.enabled) {
        return;
      }
      ctx = APP.graph_ctx;
      ctx.beginPath();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.moveTo(this.from.position.x, this.from.position.y);
      ctx.lineTo(this.to.position.x, this.to.position.y);
      ctx.stroke();
      ctx.beginPath();
      if (APP.pen === this) {
        ctx.arc(this.position.x, this.position.y, this.radius + 3, 0, TAU);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.globalOpacity = 0.4;
        ctx.stroke();
        return ctx.globalOpacity = 1.0;
      } else {
        ctx.lineWidth = 3;
        ctx.arc(this.position.x, this.position.y, this.radius + 1, 0, TAU);
        return ctx.stroke();
      }
    };

    LERP.prototype.update_order_0_point_label_color = function() {
      var color, hsv, l, len, p, ref, results, rgb;
      rgb = Color.hex2rgb(this.color);
      hsv = Color.rgb2hsv(rgb[0], rgb[1], rgb[2]);
      hsv[0] += 0.7;
      if (hsv[0] > 1.0) {
        hsv[0] -= 1.0;
      }
      hsv[1] *= 0.5;
      hsv[2] *= 0.55;
      rgb = Color.hsv2rgb(hsv[0], hsv[1], hsv[2]);
      color = Color.rgbarr2hex(rgb);
      ref = APP.points[0];
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        p = ref[l];
        results.push(p.label_color = color);
      }
      return results;
    };

    return LERP;

  })(Point);

  LERPingSplines = (function() {
    LERPingSplines.min_points = 2;

    LERPingSplines.max_points = 8;

    LERPingSplines.max_lerp_order = function() {
      return LERPingSplines.max_points - 1;
    };

    LERPingSplines.create_point_margin = 0.12;

    LERPingSplines.point_radius = 5;

    LERPingSplines.point_move_margin = 24;

    LERPingSplines.point_label_flip_margin = 32;

    LERPingSplines.point_labels = "ABCDEFGHIJKLM";

    LERPingSplines.point_label_height = 22;

    LERPingSplines.pen_label_height = 22;

    LERPingSplines.mouseover_point_radius_boost = 6;

    LERPingSplines.storage_prefix = 'lerp_spline';

    function LERPingSplines(context) {
      this.context = context;
      this.schedule_first_frame = bind(this.schedule_first_frame, this);
      this.first_update_callback = bind(this.first_update_callback, this);
      this.schedule_next_frame = bind(this.schedule_next_frame, this);
      this.update_callback = bind(this.update_callback, this);
      this.update = bind(this.update, this);
      this.update_at = bind(this.update_at, this);
      this.redraw_ui = bind(this.redraw_ui, this);
      this.on_mouseup = bind(this.on_mouseup, this);
      this.on_mouseup_canvas = bind(this.on_mouseup_canvas, this);
      this.on_mouseup_tslider = bind(this.on_mouseup_tslider, this);
      this.on_mousedown = bind(this.on_mousedown, this);
      this.on_tslider_mousedown = bind(this.on_tslider_mousedown, this);
      this.on_mousemove = bind(this.on_mousemove, this);
      this.on_mousemove_canvas = bind(this.on_mousemove_canvas, this);
      this.on_mousemove_tslider = bind(this.on_mousemove_tslider, this);
      this.on_hide_algorithm_false = bind(this.on_hide_algorithm_false, this);
      this.on_show_algorithm_true = bind(this.on_show_algorithm_true, this);
      this.stop = bind(this.stop, this);
      this.start = bind(this.start, this);
      this.on_tslide_btn_max_click = bind(this.on_tslide_btn_max_click, this);
      this.on_tslide_btn_min_click = bind(this.on_tslide_btn_min_click, this);
      this.on_tslider_bg_click = bind(this.on_tslider_bg_click, this);
      this.on_btn_play_pause_click = bind(this.on_btn_play_pause_click, this);
      this.on_remove_point_btn_click = bind(this.on_remove_point_btn_click, this);
      this.on_add_point_btn_click = bind(this.on_add_point_btn_click, this);
      this.on_show_ticks_checkbox = bind(this.on_show_ticks_checkbox, this);
      this.on_show_tooltips_change = bind(this.on_show_tooltips_change, this);
    }

    LERPingSplines.prototype.init = function() {
      var ref, ref1;
      console.log('Starting init()...');
      this.running = false;
      this.content_el = this.context.getElementById('content');
      this.show_tooltips = this.context.getElementById('show_tooltips');
      this.show_tooltips.addEventListener('change', this.on_show_tooltips_change);
      this.show_tooltips.checked = true;
      this.option = {
        show_ticks: new UI.BoolOption('show_ticks', false),
        show_pen_label: new UI.BoolOption('show_pen_label', true),
        show_algorithm: new UI.BoolOption('show_algorithm', true),
        alt_algorithm_names: new UI.BoolOption('alt_algorithm_names', true),
        rebalance_points_on_order_up: new UI.BoolOption('rebalance_points_on_order_up', false),
        rebalance_points_on_order_down: new UI.BoolOption('rebalance_points_on_order_down', false),
        show_tooltips: new UI.BoolOption('show_tooltips', true)
      };
      this.option.show_algorithm.register_callback({
        on_true: this.on_show_algorithm_true,
        on_false: this.on_show_algorithm_false
      });
      this.graph_wrapper = this.find_element('graph_wrapper');
      this.graph_canvas = this.find_element('graph');
      this.graph_ctx = this.graph_canvas.getContext('2d', {
        alpha: true
      });
      this.graph_ctx.font = "bold " + LERPingSplines.point_label_height + "px sans-serif";
      this.graph_width = this.graph_canvas.width;
      this.graph_height = this.graph_canvas.height;
      this.point_move_margin = {
        min_x: LERPingSplines.point_move_margin,
        min_y: LERPingSplines.point_move_margin,
        max_x: this.graph_width - LERPingSplines.point_move_margin,
        max_y: this.graph_height - LERPingSplines.point_move_margin
      };
      this.point_label_flip_margin = {
        min_x: LERPingSplines.point_label_flip_margin,
        min_y: LERPingSplines.point_label_flip_margin,
        max_x: this.graph_width - LERPingSplines.point_label_flip_margin,
        max_y: this.graph_height - LERPingSplines.point_label_flip_margin
      };
      this.points = [];
      this.enabled_points = 0;
      this.tvar = this.context.getElementById('tvar');
      this.tslider_btn_min = this.find_element('tbox_slider_btn_min');
      this.tslider_btn_min.addEventListener('click', this.on_tslide_btn_min_click);
      this.tslider_btn_max = this.find_element('tbox_slider_btn_max');
      this.tslider_btn_max.addEventListener('click', this.on_tslide_btn_max_click);
      this.tslider_bg = this.find_element('tbox_slider');
      this.tslider_bg.addEventListener('click', this.on_tslider_bg_click);
      this.tslider = {
        handle: this.find_element('tbox_slider_handle'),
        min: 0,
        max: 264,
        drag_active: false
      };
      this.tslider.position = this.tslider.min;
      this.tslider.range = this.tslider.max - this.tslider.min;
      this.tslider.handle.addEventListener('mousedown', this.on_tslider_mousedown);
      this.reset_loop();
      this.btn_play_pause = this.find_element('button_play_pause');
      this.btn_play_pause.addEventListener('click', this.on_btn_play_pause_click);
      this.num_points = this.find_element('num_points');
      this.add_point_btn = this.find_element('add_point');
      if ((ref = this.add_point_btn) != null) {
        ref.addEventListener('click', this.on_add_point_btn_click);
      }
      this.remove_point_btn = this.find_element('remove_point');
      if ((ref1 = this.remove_point_btn) != null) {
        ref1.addEventListener('click', this.on_remove_point_btn_click);
      }
      this.context.addEventListener('mousemove', this.on_mousemove);
      this.context.addEventListener('mousedown', this.on_mousedown);
      this.context.addEventListener('mouseup', this.on_mouseup);
      this.pen_label = 'P';
      this.pen_label_metrics = APP.graph_ctx.measureText(this.pen_label);
      this.pen_label_width = this.pen_label_metrics.width;
      this.pen_label_height = LERPingSplines.pen_label_height;
      this.pen_label_offset = {
        x: this.pen_label_width / 2,
        y: this.pen_label_height / 2
      };
      this.pen_label_offset_length = Vec2.magnitude(this.pen_label_offset);
      this.algorithmbox = this.find_element('algorithmbox');
      this.algorithm_text = this.find_element('algorithm_text');
      console.log('init() completed!');
      this.add_initial_points();
      this.update();
      return this.stop();
    };

    LERPingSplines.prototype.debug = function(msg_text) {
      var hdr, line, msg, timestamp;
      if (this.debugbox == null) {
        this.debugbox = this.context.getElementById('debugbox');
        this.debugbox.classList.remove('hidden');
      }
      hdr = this.create_element('span', {
        "class": ['hdr']
      });
      msg = this.create_element('span', {
        "class": ['msg']
      });
      timestamp = new Date();
      hdr.textContent = timestamp.toISOString();
      msg.textContent = '' + msg_text;
      line = this.create_element('div', {
        "class": ['dbg_line']
      });
      line.appendChild(hdr);
      line.appendChild(msg);
      return this.debugbox.appendChild(line);
    };

    LERPingSplines.prototype.create_element = function(tag_name, opt) {
      var el, klass, l, len, ref;
      if (opt == null) {
        opt = {};
      }
      el = this.context.createElement(tag_name);
      if (opt['class'] != null) {
        ref = opt['class'];
        for (l = 0, len = ref.length; l < len; l++) {
          klass = ref[l];
          el.classList.add(klass);
        }
      }
      return el;
    };

    LERPingSplines.prototype.find_element = function(id) {
      var el;
      el = this.context.getElementById(id);
      if (el == null) {
        this.debug("ERROR: missing element #" + id);
      }
      return el;
    };

    LERPingSplines.prototype.storage_key = function(key) {
      return this.constructor.storage_prefix + "-" + key;
    };

    LERPingSplines.prototype.storage_set = function(key, value, default_value) {
      if (default_value == null) {
        default_value = null;
      }
      if ((default_value != null) && (default_value === value)) {
        return this.storage_remove(key);
      } else {
        return localStorage.setItem(this.storage_key(key), value);
      }
    };

    LERPingSplines.prototype.storage_get = function(key) {
      return localStorage.getItem(this.storage_key(key));
    };

    LERPingSplines.prototype.storage_get_int = function(key) {
      return parseInt(this.storage_get(key));
    };

    LERPingSplines.prototype.storage_get_float = function(key) {
      return parseFloat(this.storage_get(key));
    };

    LERPingSplines.prototype.storage_remove = function(key) {
      return localStorage.removeItem(this.storage_key(key));
    };

    LERPingSplines.prototype.reset_loop = function() {
      this.t = 0;
      this.t_step = 0.002;
      return this.set_tslider_position(this.tslider.min);
    };

    LERPingSplines.prototype.loop_start = function() {
      return this.loop_running = true;
    };

    LERPingSplines.prototype.loop_stop = function() {
      return this.loop_running = false;
    };

    LERPingSplines.prototype.add_initial_points = function() {
      var i, j, l, lerp, m, margin, n, order, prev, prev_order, range, ref, ref1, ref2, x, y;
      margin = LERPingSplines.create_point_margin;
      range = 1.0 - (2.0 * margin);
      this.points[0] = [];
      for (i = l = 0, ref = LERPingSplines.max_points; 0 <= ref ? l <= ref : l >= ref; i = 0 <= ref ? ++l : --l) {
        x = margin + (range * Math.random());
        y = margin + (range * Math.random());
        this.points[0][i] = new Point(x * this.graph_width, y * this.graph_height);
        this.points[0][i].set_label(LERPingSplines.point_labels[i]);
      }
      for (order = m = 1, ref1 = LERPingSplines.max_points; 1 <= ref1 ? m <= ref1 : m >= ref1; order = 1 <= ref1 ? ++m : --m) {
        this.points[order] = [];
        prev_order = order - 1;
        prev = this.points[prev_order];
        for (j = n = 0, ref2 = LERPingSplines.max_points - order; 0 <= ref2 ? n <= ref2 : n >= ref2; j = 0 <= ref2 ? ++n : --n) {
          lerp = new LERP(order, prev[j], prev[j + 1]);
          this.points[order][j] = lerp;
          this.points[order][j].generate_label(order, j);
        }
      }
      this.enable_point_at(0.06, 0.82);
      this.enable_point_at(0.72, 0.18);
      this.update_enabled_points();
      return console.log('Initial points created!');
    };

    LERPingSplines.prototype.find_point = function(x, y) {
      var l, len, p, ref;
      ref = this.points[0];
      for (l = 0, len = ref.length; l < len; l++) {
        p = ref[l];
        if (p != null ? p.contains(x, y) : void 0) {
          return p;
        }
      }
      return null;
    };

    LERPingSplines.prototype.update_enabled_points = function() {
      var i, l, p, ref;
      if (this.enabled_points < LERPingSplines.max_points) {
        this.add_point_btn.disabled = false;
      } else {
        this.add_point_btn.disabled = true;
      }
      if (this.enabled_points > LERPingSplines.min_points) {
        this.remove_point_btn.disabled = false;
      } else {
        this.remove_point_btn.disabled = true;
      }
      this.num_points.textContent = "" + this.enabled_points;
      this.update();
      p = null;
      for (i = l = ref = LERPingSplines.max_points - 1; ref <= 1 ? l <= 1 : l >= 1; i = ref <= 1 ? ++l : --l) {
        p = this.points[i][0];
        if (p != null ? p.enabled : void 0) {
          break;
        }
      }
      if (p != null) {
        this.pen = p;
        this.pen.update_order_0_point_label_color();
      } else {
        this.debug("ERROR: no pen?!");
      }
      return this.update_algorithm();
    };

    LERPingSplines.prototype.enable_point = function(rebalance_points) {
      var cur, cur_id, k, p, prev, prev_id, x, y;
      if (this.enabled_points >= LERPingSplines.max_points) {
        return;
      }
      p = this.points[0][this.enabled_points];
      if (rebalance_points && this.option.rebalance_points_on_order_up.value) {
        cur_id = this.enabled_points;
        prev_id = cur_id - 1;
        while (prev_id >= 0) {
          cur = this.points[0][cur_id];
          prev = this.points[0][prev_id];
          k = this.enabled_points;
          x = ((k - cur_id) / k) * cur.position.x + (cur_id / k) * prev.position.x;
          y = ((k - cur_id) / k) * cur.position.y + (cur_id / k) * prev.position.y;
          cur.move(x, y);
          cur_id--;
          prev_id--;
        }
      }
      p.enabled = true;
      this.enabled_points += 1;
      this.update_enabled_points();
      return p;
    };

    LERPingSplines.prototype.enable_point_at = function(x, y) {
      var p;
      p = this.enable_point(false);
      p.x = x * this.graph_width;
      p.y = y * this.graph_height;
      return p;
    };

    LERPingSplines.prototype.compute_lower_order_curve = function() {
      var i, l, p, points, ref, results;
      points = this.points[0].map(function(point) {
        return {
          x: point.position.x,
          y: point.position.y
        };
      });
      /* copied from: https://pomax.github.io/bezierinfo/chapters/reordering/reorder.js */

    // Based on https://www.sirver.net/blog/2011/08/23/degree-reduction-of-bezier-curves/

    // TODO: FIXME: this is the same code as in the old codebase,
    //              and it does something odd to the either the
    //              first or last point... it starts to travel
    //              A LOT more than it looks like it should... O_o

    p = points,
    k = p.length,
    data = [],
    n = k-1;

    //if (k <= 3) return;

    // build M, which will be (k) rows by (k-1) columns
    for(let i=0; i<k; i++) {
      data[i] = (new Array(k - 1)).fill(0);
      if(i===0) { data[i][0] = 1; }
      else if(i===n) { data[i][i-1] = 1; }
      else {
        data[i][i-1] = i / k;
        data[i][i] = 1 - data[i][i-1];
      }
    }

    // Apply our matrix operations:
    const M = new Matrix(data);
    const Mt = M.transpose(M);
    const Mc = Mt.multiply(M);
    const Mi = Mc.invert();

    if (!Mi) {
      return console.error('MtM has no inverse?');
    }

    // And then we map our k-order list of coordinates
    // to an n-order list of coordinates, instead:
    const V = Mi.multiply(Mt);
    const x = new Matrix(points.map(p => [p.x]));
    const nx = V.multiply(x);
    const y = new Matrix(points.map(p => [p.y]));
    const ny = V.multiply(y);

    points = nx.data.map((x,i) => ({
      x: x[0],
      y: ny.data[i][0]
    }));;
      results = [];
      for (i = l = 0, ref = points.length; 0 <= ref ? l < ref : l > ref; i = 0 <= ref ? ++l : --l) {
        p = this.clamp_to_canvas(points[i]);
        results.push(this.points[0][i].move(p.x, p.y));
      }
      return results;
    };

    LERPingSplines.prototype.disable_point = function() {
      var p;
      if (this.enabled_points <= LERPingSplines.min_points) {
        return;
      }
      if (this.enabled_points > 3 && this.option.rebalance_points_on_order_down.value) {
        this.compute_lower_order_curve();
      }
      this.enabled_points -= 1;
      p = this.points[0][this.enabled_points];
      p.enabled = false;
      return this.update_enabled_points();
    };

    LERPingSplines.prototype.on_show_tooltips_change = function(event) {
      if (this.show_tooltips.checked) {
        return this.content_el.classList.add('show_tt');
      } else {
        return this.content_el.classList.remove('show_tt');
      }
    };

    LERPingSplines.prototype.on_show_ticks_checkbox = function(event, ui) {
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_add_point_btn_click = function(event, ui) {
      this.enable_point(true);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_remove_point_btn_click = function(event, ui) {
      this.disable_point();
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_btn_play_pause_click = function(event, ui) {
      if (this.running) {
        return this.stop();
      } else {
        return this.start();
      }
    };

    LERPingSplines.prototype.set_tslider_position = function(x) {
      if (x < this.tslider.min) {
        x = this.tslider.min;
      }
      if (x > this.tslider.max) {
        x = this.tslider.max;
      }
      this.tslider.position = x;
      this.tslider.handle.style.left = x + "px";
      return this.set_t((x - this.tslider.min) / this.tslider.range);
    };

    LERPingSplines.prototype.on_tslider_bg_click = function(event) {
      var cc, coord_x, slider_pos, t;
      cc = this.tslider_bg.getBoundingClientRect();
      coord_x = event.pageX - cc.left;
      coord_x -= window.scrollX;
      t = coord_x / cc.width;
      slider_pos = this.tslider.min + (t * (this.tslider.max - this.tslider.min));
      this.set_tslider_position(slider_pos);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_tslide_btn_min_click = function() {
      this.set_tslider_position(this.tslider.min);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_tslide_btn_max_click = function() {
      this.set_tslider_position(this.tslider.max);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.set_t = function(value) {
      this.t = value;
      while (this.t > 1.0) {
        this.t -= 1.0;
      }
      this.tvar.textContent = this.t.toFixed(2);
      if (this.t === 0.0) {
        this.tslider_btn_min.disabled = true;
      } else {
        this.tslider_btn_min.disabled = false;
      }
      if (this.t === 1.0) {
        return this.tslider_btn_max.disabled = true;
      } else {
        return this.tslider_btn_max.disabled = false;
      }
    };

    LERPingSplines.prototype.start = function() {
      if (this.running) {

      } else {
        this.running = true;
        this.btn_play_pause.innerHTML = "&#x23F8;";
        return this.schedule_first_frame();
      }
    };

    LERPingSplines.prototype.stop = function() {
      this.running = false;
      return this.btn_play_pause.innerHTML = "&#x23F5;";
    };

    LERPingSplines.prototype.update_algorithm = function() {
      var l, label, len, lines, m, order, p, ref, ref1;
      if (!this.option.show_algorithm.value) {
        return;
      }
      lines = [];
      for (order = l = 0, ref = this.enabled_points - 1; 0 <= ref ? l <= ref : l >= ref; order = 0 <= ref ? ++l : --l) {
        if (order > 0) {
          lines.push("");
          lines.push("### Order " + order + " Bezier");
        } else {
          lines.push("### Points");
        }
        ref1 = this.points[order];
        for (m = 0, len = ref1.length; m < len; m++) {
          p = ref1[m];
          if (!p.enabled) {
            continue;
          }
          label = p === this.pen ? this.pen_label : p.get_label();
          if (order > 0) {
            lines.push(label + " = Lerp(" + (p.from.get_label()) + ", " + (p.to.get_label()) + ", t)");
          } else {
            lines.push(label + " = <" + (parseInt(p.position.x, 10)) + ", " + (parseInt(p.position.y, 10)) + ">");
          }
        }
      }
      return this.algorithm_text.innerText = lines.join("\n");
    };

    LERPingSplines.prototype.on_show_algorithm_true = function() {
      this.algorithmbox.classList.remove('hidden');
      return this.update_algorithm();
    };

    LERPingSplines.prototype.on_hide_algorithm_false = function() {
      return this.algorithmbox.classList.add('hidden');
    };

    LERPingSplines.prototype.clamp_to_canvas = function(v) {
      if (v.x < this.point_move_margin.min_x) {
        v.x = this.point_move_margin.min_x;
      }
      if (v.y < this.point_move_margin.min_y) {
        v.y = this.point_move_margin.min_y;
      }
      if (v.x > this.point_move_margin.max_x) {
        v.x = this.point_move_margin.max_x;
      }
      if (v.y > this.point_move_margin.max_y) {
        v.y = this.point_move_margin.max_y;
      }
      return v;
    };

    LERPingSplines.prototype.get_mouse_coord = function(event) {
      var cc, coord;
      cc = this.graph_canvas.getBoundingClientRect();
      coord = {
        x: event.pageX - cc.left,
        y: event.pageY - cc.top
      };
      coord.x -= window.scrollX;
      coord.y -= window.scrollY;
      return this.clamp_to_canvas(coord);
    };

    LERPingSplines.prototype.on_mousemove_tslider = function(event) {
      var mouse, offset;
      mouse = this.get_mouse_coord(event);
      offset = mouse.x - this.tslider.drag_start;
      this.set_tslider_position(this.tslider.drag_start_position + offset);
      return this.update_and_draw();
    };

    LERPingSplines.prototype.on_mousemove_canvas = function(event) {
      var l, len, mouse, oldhover, oldx, oldy, order, p, ref, results;
      mouse = this.get_mouse_coord(event);
      ref = this.points;
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        order = ref[l];
        results.push((function() {
          var len1, m, results1;
          results1 = [];
          for (m = 0, len1 = order.length; m < len1; m++) {
            p = order[m];
            oldx = p.x;
            oldy = p.y;
            if (p.selected) {
              if ((p.x !== mouse.x) || (p.y !== mouse.y)) {
                this.point_has_changed = true;
              }
              p.x = mouse.x;
              p.y = mouse.y;
            }
            oldhover = p.hover;
            if (p.contains(mouse.x, mouse.y)) {
              p.hover = true;
            } else {
              p.hover = false;
            }
            if ((p.hover !== oldhover) || (p.x !== oldx) || (p.y !== oldy)) {
              results1.push(this.update_and_draw());
            } else {
              results1.push(void 0);
            }
          }
          return results1;
        }).call(this));
      }
      return results;
    };

    LERPingSplines.prototype.on_mousemove = function(event) {
      if (this.tslider.drag_active) {
        return this.on_mousemove_tslider(event);
      } else {
        return this.on_mousemove_canvas(event);
      }
    };

    LERPingSplines.prototype.on_tslider_mousedown = function(event) {
      var mouse;
      this.tslider.drag_active = true;
      mouse = this.get_mouse_coord(event);
      this.tslider.drag_start = mouse.x;
      this.tslider.drag_start_position = this.tslider.position;
      this.tslider.handle.classList.add('drag');
      if (this.running) {
        return this.stop();
      }
    };

    LERPingSplines.prototype.on_mousedown = function(event) {
      var mouse, p;
      this.point_has_changed = false;
      mouse = this.get_mouse_coord(event);
      p = this.find_point(mouse.x, mouse.y);
      if (p != null) {
        return p.selected = true;
      }
    };

    LERPingSplines.prototype.on_mouseup_tslider = function(event) {
      this.tslider.drag_active = false;
      return this.tslider.handle.classList.remove('drag');
    };

    LERPingSplines.prototype.on_mouseup_canvas = function(event) {
      var l, len, len1, m, order, p, ref;
      ref = this.points;
      for (l = 0, len = ref.length; l < len; l++) {
        order = ref[l];
        for (m = 0, len1 = order.length; m < len1; m++) {
          p = order[m];
          p.selected = false;
        }
      }
      if (this.point_has_changed) {
        return this.update_algorithm();
      }
    };

    LERPingSplines.prototype.on_mouseup = function(event) {
      if (this.tslider.drag_active) {
        return this.on_mouseup_tslider(event);
      } else {
        return this.on_mouseup_canvas(event);
      }
    };

    LERPingSplines.prototype.redraw_ui = function(render_bitmap_preview) {
      var l, len, len1, m, order, p, ref, ref1;
      if (render_bitmap_preview == null) {
        render_bitmap_preview = true;
      }
      this.graph_ui_ctx.clearRect(0, 0, this.graph_ui_canvas.width, this.graph_ui_canvas.height);
      if ((ref = this.cur) != null) {
        ref.draw_ui();
      }
      ref1 = this.points;
      for (l = 0, len = ref1.length; l < len; l++) {
        order = ref1[l];
        for (m = 0, len1 = order.length; m < len1; m++) {
          p = order[m];
          p.draw_ui();
        }
      }
      return null;
    };

    LERPingSplines.prototype.update_at = function(t) {
      var l, len, order, p, ref, results;
      ref = this.points;
      results = [];
      for (l = 0, len = ref.length; l < len; l++) {
        order = ref[l];
        results.push((function() {
          var len1, m, results1;
          results1 = [];
          for (m = 0, len1 = order.length; m < len1; m++) {
            p = order[m];
            results1.push(p.update(t));
          }
          return results1;
        })());
      }
      return results;
    };

    LERPingSplines.prototype.update = function() {
      return this.update_at(this.t);
    };

    LERPingSplines.prototype.draw_bezier = function() {
      var ctx, i, l, p, ref, start, t;
      start = this.points[0][0];
      p = null;
      for (i = l = ref = LERPingSplines.max_points - 1; ref <= 1 ? l <= 1 : l >= 1; i = ref <= 1 ? ++l : --l) {
        p = this.points[i][0];
        if (p != null ? p.enabled : void 0) {
          break;
        }
      }
      if (this.pen == null) {
        this.debug("missing pen");
      }
      if (p !== this.pen) {
        console.log('p', p);
        console.log('@pen', this.pen);
      }
      p = this.pen;
      ctx = this.graph_ctx;
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      t = 0.0;
      this.update_at(t);
      ctx.moveTo(p.position.x, p.position.y);
      while (t < 1.0) {
        t += 0.02;
        this.update_at(t);
        ctx.lineTo(p.position.x, p.position.y);
      }
      return ctx.stroke();
    };

    LERPingSplines.prototype.draw = function() {
      var l, len, len1, len2, len3, m, n, o, order, p, ref, ref1, ref2, results;
      ref = this.points;
      for (l = 0, len = ref.length; l < len; l++) {
        order = ref[l];
        for (m = 0, len1 = order.length; m < len1; m++) {
          p = order[m];
          if (p.order > 1) {
            p.draw();
          }
        }
      }
      ref1 = this.points[1];
      for (n = 0, len2 = ref1.length; n < len2; n++) {
        p = ref1[n];
        p.draw();
      }
      ref2 = this.points[0];
      results = [];
      for (o = 0, len3 = ref2.length; o < len3; o++) {
        p = ref2[o];
        results.push(p.draw());
      }
      return results;
    };

    LERPingSplines.prototype.get_normal = function() {
      var normal;
      this.update_at(this.t - this.t_step);
      this.pen.prev_position.x = this.pen.position.x;
      this.pen.prev_position.y = this.pen.position.y;
      this.update();
      if ((this.pen.prev_position.x != null) && (this.pen.prev_position.y != null)) {
        normal = {
          x: -(this.pen.position.y - this.pen.prev_position.y),
          y: this.pen.position.x - this.pen.prev_position.x
        };
        return Vec2.normalize(normal);
      } else {
        return null;
      }
    };

    LERPingSplines.prototype.draw_pen = function() {
      var angle, arrow, arrow_shaft, arrow_side1, arrow_side2, arrowtip, ctx, normal, plabel_offset, plx, ply;
      if (this.pen == null) {
        return;
      }
      normal = this.get_normal();
      if (normal != null) {
        arrow = Vec2.scale(normal, 22.0);
        arrowtip = Vec2.scale(normal, 15.0);
        arrow_shaft = Vec2.scale(normal, 65.0);
        angle = TAU / 8.0;
        arrow_side1 = Vec2.rotate(arrow, angle);
        arrow_side2 = Vec2.rotate(arrow, -angle);
        arrowtip.x += this.pen.position.x;
        arrowtip.y += this.pen.position.y;
        ctx = this.graph_ctx;
        ctx.beginPath();
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow_shaft.x, arrowtip.y + arrow_shaft.y);
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow_side1.x, arrowtip.y + arrow_side1.y);
        ctx.moveTo(arrowtip.x, arrowtip.y);
        ctx.lineTo(arrowtip.x + arrow_side2.x, arrowtip.y + arrow_side2.y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
        if (this.option.show_pen_label.value) {
          plabel_offset = Vec2.scale(Vec2.normalize(arrow_shaft), this.pen_label_offset_length + 3);
          plx = arrowtip.x + arrow_shaft.x + plabel_offset.x - this.pen_label_offset.x;
          ply = arrowtip.y + arrow_shaft.y + plabel_offset.y - this.pen_label_offset.y + this.pen_label_height;
          ctx.fillStyle = '#000';
          return ctx.fillText(this.pen_label, plx, ply);
        }
      }
    };

    LERPingSplines.prototype.draw_tick_at = function(t, size) {
      var ctx, normal, point_a_x, point_a_y, point_b_x, point_b_y, t_save;
      if (this.pen == null) {
        return;
      }
      t_save = this.t;
      this.t = t;
      normal = this.get_normal();
      if (normal != null) {
        normal = Vec2.scale(normal, 3 + (4.0 * size));
        point_a_x = this.pen.position.x + normal.x;
        point_a_y = this.pen.position.y + normal.y;
        point_b_x = this.pen.position.x - normal.x;
        point_b_y = this.pen.position.y - normal.y;
        ctx = this.graph_ctx;
        ctx.beginPath();
        ctx.moveTo(point_a_x, point_a_y);
        ctx.lineTo(point_b_x, point_b_y);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = size > 3 ? 2 : 1;
        ctx.stroke();
      }
      return this.t = t_save;
    };

    LERPingSplines.prototype.draw_ticks = function() {
      this.draw_tick_at(0.0, 5);
      this.draw_tick_at(0.03125, 1);
      this.draw_tick_at(0.0625, 2);
      this.draw_tick_at(0.09375, 1);
      this.draw_tick_at(0.125, 3);
      this.draw_tick_at(0.15625, 1);
      this.draw_tick_at(0.1875, 2);
      this.draw_tick_at(0.21875, 1);
      this.draw_tick_at(0.25, 4);
      this.draw_tick_at(0.28125, 1);
      this.draw_tick_at(0.3125, 2);
      this.draw_tick_at(0.34375, 1);
      this.draw_tick_at(0.375, 3);
      this.draw_tick_at(0.40625, 1);
      this.draw_tick_at(0.4375, 2);
      this.draw_tick_at(0.46875, 1);
      this.draw_tick_at(0.5, 5);
      this.draw_tick_at(0.53125, 1);
      this.draw_tick_at(0.5625, 2);
      this.draw_tick_at(0.59375, 1);
      this.draw_tick_at(0.625, 3);
      this.draw_tick_at(0.65625, 1);
      this.draw_tick_at(0.6875, 2);
      this.draw_tick_at(0.71875, 1);
      this.draw_tick_at(0.75, 4);
      this.draw_tick_at(0.78125, 1);
      this.draw_tick_at(0.8125, 2);
      this.draw_tick_at(0.84375, 1);
      this.draw_tick_at(0.875, 3);
      this.draw_tick_at(0.90625, 1);
      this.draw_tick_at(0.9375, 2);
      this.draw_tick_at(0.96875, 1);
      return this.draw_tick_at(1.0, 5);
    };

    LERPingSplines.prototype.update_and_draw = function() {
      this.graph_ctx.clearRect(0, 0, this.graph_canvas.width, this.graph_canvas.height);
      if (this.option.show_ticks.value) {
        this.draw_ticks();
      }
      this.draw_bezier();
      this.update();
      this.draw();
      return this.draw_pen();
    };

    LERPingSplines.prototype.update_callback = function(timestamp) {
      var elapsed;
      this.frame_is_scheduled = false;
      elapsed = timestamp - this.prev_anim_timestamp;
      if (elapsed > 0) {
        this.prev_anim_timestamp = this.anim_timestamp;
        this.set_t(this.t + this.t_step);
        this.set_tslider_position(this.tslider.min + (this.t * this.tslider.range));
        this.update_and_draw();
      }
      if (this.running) {
        this.schedule_next_frame();
      }
      return null;
    };

    LERPingSplines.prototype.schedule_next_frame = function() {
      if (!this.frame_is_scheduled) {
        this.frame_is_scheduled = true;
        window.requestAnimationFrame(this.update_callback);
      }
      return null;
    };

    LERPingSplines.prototype.first_update_callback = function(timestamp) {
      this.anim_timestamp = timestamp;
      this.prev_anim_timestamp = timestamp;
      this.frame_is_scheduled = false;
      return this.schedule_next_frame();
    };

    LERPingSplines.prototype.schedule_first_frame = function() {
      this.frame_is_scheduled = true;
      window.requestAnimationFrame(this.first_update_callback);
      return null;
    };

    return LERPingSplines;

  })();

  document.addEventListener('DOMContentLoaded', (function(_this) {
    return function() {
      window.APP = new LERPingSplines(document);
      window.APP.init();
      return window.APP.draw();
    };
  })(this));

}).call(this);
