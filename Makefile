#
# config
#

PROJECT = lerping_splines

COFFEE ?= coffee --no-header --compile
RM ?= rm -f

SASS ?= sass
SASS_OPTS = \
	--sourcemap=none \
	--style=compact \
	--stop-on-error \
	-E UTF-8 \
	--unix-newlines

#
# build deps
#

PROJECT_COFFEE_SRC =         \
	src/color.coffee     \
	src/curve.coffee     \
	src/main.coffee      \
	src/math.coffee      \
	src/point.coffee     \
	src/uioption.coffee

JS_TARGETS = $(PROJECT).js

CSS_TARGETS = colorize.css

TARGETS = \
	$(JS_TARGETS) \
	$(CSS_TARGETS)

#
# build instructions
#
all: build
build: $(TARGETS)

debug: COFFEE += --inline-map
debug: $(TARGETS)

$(PROJECT).js: $(PROJECT_COFFEE_SRC)
	cat $^ | $(COFFEE)  --stdio > $@

%.css: %.sass
	$(SASS) $(SASS_OPTS) $< $@

clean:
	$(RM) $(TARGETS)

.PHONY: all build debug clean
