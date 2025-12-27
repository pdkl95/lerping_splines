window.UI or= {}
class UI.Option
  @create_input_element: (type = null, id = null) =>
    el = window.APP.context.createElement('input')
    el.id = id if id?
    el.type = type if type?
    el

  constructor: (@id, default_value = null, @callback = {}) ->
    if @id instanceof Element
      @id = @el.id
    else
      @el = window.APP.context.getElementById(@id)
      unless @el?
        console.log("ERROR - could not find element with id=\"#{@id}\"")

    @persist = true
    @storage_id = "ui_option-#{@id}"
    @label_id = "#{@id}_label"
    @label_el = window.APP.context.getElementById(@label_id)

    @label_text_formater = @default_label_text_formater

    if default_value?
      @default = default_value
    else
      @default = @detect_default_value()

    stored_value = APP.storage_get(@storage_id)
    if stored_value?
      @set(stored_value)
    else
      @set(@default)

    @setup_listeners()

  setup_listeners: ->
    @el.addEventListener('change', @on_change)
    @el.addEventListener('input',  @on_input)

  detect_default_value: ->
    @get()

  reset: ->
    APP.storage_remove(@storage_id)
    @set(@default)

  register_callback: (opt = {}) ->
    for name, func of opt
      @callback[name] = func

    for key, func of @callback
      delete @callback[name] unless func?

  set_value: (new_value = null) ->
    @value = new_value if new_value?
    @label_el.innerText = @label_text() if @label_el?

    if @persist
      APP.storage_set(@storage_id, @value, @default)
 
  default_label_text_formater: (value) ->
    "#{value}"

  label_text: ->
    @label_text_formater(@value)

  set_label_text_formater: (func) ->
    @label_text_formater = func
    @set_value()

  on_change: (event) => 
    @set(@get(event.target), false)
    @callback.on_change?(@value)

  on_input: (event) =>
    @set(@get(event.target), false)
    @callback.on_input?(@value)

  enable: ->
    @el.disabled = false

  disable: ->
    @el.disabled = true

  destroy: ->
    @el.remove() if @el?
    @el = null

class UI.BoolOption extends UI.Option
  @create: (parent, @id, rest...) ->
    opt = new UI.BoolOption(UIOption.create_input_element('checkbox', @id), rest...)
    parent.appendChild(opt.el)
    opt

  constructor: (args...) ->
    super(args...)

    parent = @el.parentElement

    @on_el =window.APP.context.createElement('span')
    @on_el.id = "#{@id}_on"
    @on_el.textContent = "On"
    @on_el.classList.add("bool_option_state")
    @on_el.classList.add("on")
    @on_el.addEventListener('click', @on_bool_option_state_on_click);
    parent.appendChild(@on_el)

    @off_el =window.APP.context.createElement('span')
    @off_el.id = "#{@id}_off"
    @off_el.textContent = "Off"
    @off_el.classList.add("bool_option_state")
    @off_el.classList.add("off")
    @off_el.addEventListener('click', @on_bool_option_state_off_click);
    parent.appendChild(@off_el)

    @el.classList.add("hidden")

    @set(@get())

  on_bool_option_state_on_click: =>
    @set(false)
    @callback.on_change?(@value)

  on_bool_option_state_off_click: =>
    @set(true)
    @callback.on_change?(@value)

  get: (element = @el) ->
    element.checked

  set: (bool_value, update_element = true) ->
    oldvalue = @value
    newvalue = switch bool_value
      when 'true'  then true
      when 'false' then false
      else
        !!bool_value
    @el.checked = newvalue if update_element

    @set_value(newvalue)
    if oldvalue != newvalue
      if newvalue
        @callback.on_true?()
      else
        @callback.on_false?()

  set_value: (new_value = null) ->
    super(new_value)
    @update_on_off_classes()

  update_on_off_classes: ->
    if @get()
      @on_el.classList.remove('hidden') if @on_el?
      @off_el.classList.add('hidden') if @off_el?
    else
      @on_el.classList.add('hidden') if @on_el?
      @off_el.classList.remove('hidden') if @off_el?

class UI.IntOption extends UI.Option
  @create: (parent, @id, rest...) ->
    opt = new UI.IntOption(UIOption.create_input_element('number', @id), rest...)
    parent.appendChild(opt.el)
    opt

  get: (element = @el) ->
    parseInt(element.value)

  set: (number_value, update_element = true) ->
    @set_value(parseInt(number_value))
    @el.value = @value if update_element

class UI.FloatOption extends UI.Option
  @create: (parent, @id, rest...) ->
    opt = new UI.IntOption(UIOption.create_input_element(null, @id), rest...)
    parent.appendChild(opt.el)
    opt

  get: (element = @el) ->
    parseFloat(element.value)

  set: (number_value, update_element = true) ->
    @set_value(parseFloat(number_value))
    @el.value = @value if update_element

class UI.PercentOption extends UI.FloatOption
  label_text: ->
    perc = parseInt(@value * 100)
    "#{perc}%"

class UI.SelectOption extends UI.Option
  setup_listeners: ->
    @el.addEventListener('change', @on_change)
    # skip input event

  get: (element = @el) ->
    opt = element.options[element.selectedIndex]
    if opt?
      opt.value
    else
      null

  set: (option_name, update_element = true) ->
    opt = @option_with_name(option_name)
    if opt?
      @set_value(opt.value)
      opt.selected = true if update_element

  values: ->
    @el.options.map( (x) -> x.name )

  option_with_name: (name) ->
    for opt in @el.options
      if opt.value is name
        return opt
    return null

  add_option: (value, text, selected=false) ->
    opt = document.createElement('option')
    opt.value = value
    opt.text = text
    @el.add(opt, null)
    opt.selected = true if selected
    @set(@get())

class UI.ChoiceOption extends UI.Option
  constructor: (@group_class, default_value = null, @callback = {}) ->
    @group_selector = ".#{@group_class}"
    @el_list = window.APP.context.querySelectorAll(@group_selector)
    unless @el_list?.length > 0
        console.log("ERROR - could not find with class \"#{@name}\"")

    @persist = true
    @storage_id = "ui_option-#{@group_class}"

    @el_list.forEach(@setup_choice)

    if default_value?
      @default = default_value
    else
      @default = @detect_default_value()

    stored_value = APP.storage_get(@storage_id)
    if stored_value?
      @set(stored_value)
    else
      @set(@default)

  detect_default_value: ->
    @el_list[0].dataset.value

  setup_choice: (el) =>
    el.addEventListener('click', @on_choice_click);

  on_choice_click: (event) =>
    @set(event.target.dataset.value)

  setup_listeners: ->

  set_value: (new_value = null) ->
    if new_value?
      old_value = @value
      @value = new_value
      if old_value != new_value
        @callback.on_change?(@value)
    else
      console.log("set_value(null) called for UI.ChoiceOption \"#{@group_class}\'")

    if @persist
      APP.storage_set(@storage_id, @value, @default)

  get_element_with_value: (value) ->
    for el in @el_list
      if el.dataset.value == value
        return el
    return null

  clear_selected: ->
    for el in @el_list
      el.classList.remove('selected')

  get: ->
    @value

  set: (new_value, update_element = true) ->
    el = @get_element_with_value(new_value)
    if el?
      @set_value(new_value)
      if update_element
        @clear_selected()
        el.classList.add('selected')
    else
      console.log("Invalid value \"#{new_value}\" for UI.ChoiceOption \"#{@group_class}\'")

  change: ->
    @callback.on_change?(@value)

  enable: ->
    @el_list.forEach( (el) -> el.classList.remove('disabled') )

  disable: ->
    @el_list.forEach( (el) -> el.classList.add('disabled') )

class UI.ColorOption extends UI.Option
  get: (element = @el) ->
    element.value

  set: (new_value, update_element = true) ->
    @set_value(new_value)
    @el.value = new_value if update_element
    @color
