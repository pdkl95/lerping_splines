#
# config
#

PROJECT = lerping_splines

COFFEE ?= coffee --no-header --compile
RM ?= rm -f

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

TARGETS = $(JS_TARGETS)

#
# build instructions
#
all: build
build: $(TARGETS)

debug: COFFEE += --inline-map
debug: $(TARGETS)

$(PROJECT).js: $(PROJECT_COFFEE_SRC)
	cat $^ | $(COFFEE)  --stdio > $@

clean:
	$(RM) $(TARGETS)

.PHONY: all build debug clean
