class Color
  @hex2rgb: (h) ->
    arr = if h.length == 4
      [ h[1] + h[1],
        h[2] + h[2],
        h[3] + h[3] ]
    else if h.length == 7
      [ h[1] + h[2],
        h[3] + h[4],
        h[5] + h[6] ]
    else
      raise "string '#{h}' is not in '#RGB' or '#RRGGBB' format"

    (parseInt(value,16) / 255 for value in arr)

  @rgb2hex: (r, g, b) ->
    Color.rgbarr2hex([r,g,b])

  @rgbarr2hex: (arr) ->
    "#" + (parseInt(255 * value, 10).toString(16).padStart(2, '0') for value in arr).join('')

  #FROM: http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
  # 
  #  Converts an RGB color value to HSV. Conversion formula
  #  adapted from http://en.wikipedia.org/wiki/HSV_color_space.
  #  Assumes r, g, and b are contained in the set [0, 1] and
  #  returns h, s, and v in the set [0, 1].
  #   
  #  @param   Number  r       The red color value
  #  @param   Number  g       The green color value
  #  @param   Number  b       The blue color value
  #  @return  Array           The HSV representation
  @rgb2hsv: (r, g, b) ->
    max = Math.max(r, g, b)
    min = Math.min(r, g, b)

    v = max
    d = max - min

    s = (if max is 0 then 0 else d / max)

    if max is min
      h = 0 # achromatic
    else
      h = switch max
        when r then (g - b) / d + (if g < b then 6 else 0)
        when g then (b - r) / d + 2
        when b then (r - g) / d + 4
      h /= 6

    [h, s, v]


  #FROM: http://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c
  # 
  #  Converts an HSV color value to RGB. Conversion formula
  #  adapted from http://en.wikipedia.org/wiki/HSV_color_space.
  #  Assumes h, s, and v are contained in the set [0, 1] and
  #  returns r, g, and b in the set [0, 1].
  #  
  #  @param   Number  h       The hue
  #  @param   Number  s       The saturation
  #  @param   Number  v       The value
  #  @return  Array           The RGB representation
  @hsv2rgb: (h, s, v) ->
    i = Math.floor(h * 6)
    f = h * 6 - i
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)

    switch i % 6
      when 0 then [v, t, p]
      when 1 then [q, v, p]
      when 2 then [p, v, t]
      when 3 then [p, q, v]
      when 4 then [t, p, v]
      when 5 then [v, p, q]


