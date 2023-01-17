top_srcdir ?= .
srcdir     ?= $(top_srcdir)
builddir   ?= $(top_srcdir)

#
# config
#

COFFEE ?= coffee
COFFEE_OPTIONS ?= --no-header --compile

RM ?= rm -f

#
# build deps
#

COFFEE_SRC = $(wildcard $(srcdir)/*.coffee)
JS_TARGETS = $(patsubst $(srcdir)/%.coffee,$(builddir)/%.js,$(COFFEE_SRC))

TARGETS = $(JS_TARGETS)

#
# build instructions
#
all: build
build: $(TARGETS)

$(builddir)/%.js: $(srcdir)/%.coffee
	$(COFFEE) $(COFFEE_OPTIONS) $< > $@

clean:
	$(RM) $(TARGETS)

.PHONY: all build clean
