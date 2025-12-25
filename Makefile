top_srcdir ?= .
srcdir     ?= $(top_srcdir)
builddir   ?= $(top_srcdir)

#
# config
#

PROJECT = lerping_splines

COFFEE ?= coffee --no-header --compile
RM ?= rm -f

#
# build deps
#

PROJECT_COFFEE_SRC = \
	color.coffee \
	math.coffee  \
	main.coffee

JS_TARGETS = $(PROJECT).js

TARGETS = $(JS_TARGETS)

#
# build instructions
#
all: build
build: $(TARGETS)

$(PROJECT).js: $(PROJECT_COFFEE_SRC)
	cat $^ | $(COFFEE) --stdio > $@

clean:
	$(RM) $(TARGETS)

.PHONY: all build clean
