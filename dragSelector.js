(function(window){
    'use strict';
    function dragSelector(config) {
        return new DSInternal(config);
    }
    
    dragSelector.version = "0.0.1";
    
    function DSInternal(config) {
        if (typeof window.d3 === 'undefined') {
            throw Error("d3.js must exist in order to use the d3.js drag selector plugin. Ensure that it is placed above this file when referencing your scripts.")
        }
        this.d3 = window.d3;
        config = config || {};
        this.config = {};
        this.config.selectNode = config.selectNode;
        this.config.selectFilter = config.selectFilter;
        this.config.selectedClass = config.selectedClass || "";
        this.config.rectangleClass = config.rectangleClass || "";
        this.config.rectParentNode = (config.rectParentNode && config.rectParentNode.select) ? config.rectParentNode : (config.rectParentNode ? this.d3.select(config.rectParentNode) : null); // make it a d3 selection if it isn't
        this.config.onSelect = config.onSelect;
        this.config.onDragStart = config.onDragStart;
        this.config.onDragEnd = config.onDragEnd;
        this.config.onDragStart = config.onDragStart;
        this.config.multiSelectKey = config.multiSelectKey || "ctrl";
        this.config.preventDragBubbling = config.preventDragBubbling === false ? false : true; // default to prevent drag bubbling to stop text highlighting
    }
    
    var fn = DSInternal.prototype;
    
    fn.selectNode = function(nodeTag) {
        if (!arguments.length) return this.config.selectNode;
        this.config.selectNode = nodeTag;
        return this;
    };
    fn.selectFilter = function(filter) {
        if (!arguments.length) return this.config.selectFilter;
        this.config.selectFilter = filter;
        return this;
    };
    fn.selectedClass = function(className) {
        if (!arguments.length) return this.config.selectedClass;
        this.config.selectedClass = className;
        return this;
    };
    fn.rectangleClass = function(className) {
        if (!arguments.length) return this.config.rectangleClass;
        this.config.rectangleClass = className;
        return this;
    };
    fn.rectParentNode = function(node) {
        if (!arguments.length) return this.config.rectParentNode;
        this.config.rectParentNode = node;
        return this;
    };
    fn.onSelect = function(cb) {
        if (!arguments.length) return this.config.onSelect;
        this.config.onSelect = cb;
        return this;
    };
    fn.onDragStart = function(cb) {
        if (!arguments.length) return this.config.onDragStart;
        this.config.onDragStart = cb;
        return this;
    };
    fn.onDragEnd = function(cb) {
        if (!arguments.length) return this.config.onDragEnd;
        this.config.onDragEnd = cb;
        return this;
    };
    fn.multiSelectKey = function(key) {
        if (!arguments.length) return this.config.multiSelectKey;
        this.config.multiSelectKey = key;
        return this;
    };
    fn.preventDragBubbling = function(bool) {
        if (!arguments.length) return this.config.preventDragBubbling;
        this.config.preventDragBubbling = bool;
        return this;
    };
    
    fn.selector = function() {
        var $$ = this;
        return function(node) {
            internalSelectInit.call($$, node);
        };
    };
    
    function internalSelectInit(node) {
        var $$ = this,
            rect,
            targets = node.selectAll($$.config.selectFilter || $$.config.selectNode),
            currentlyFound = "";
        node.on("mousedown", function(d, i, a) {
            if (($$.config.multiSelectKey === "ctrl" && $$.d3.event.ctrlKey) || 
                ($$.config.multiSelectKey === "shift" && $$.d3.event.shiftKey) || 
                ($$.config.multiSelectKey === "alt" && $$.d3.event.altKey)) {
                targets = targets.filter(":not(." + $$.config.selectedClass + ")"); // set the targets (the things to be searched) to exclude those already selected
            } else {
                targets = node.selectAll($$.config.selectFilter || $$.config.selectNode); // else reset - we search all
            }
            if (rect) rect.remove();
            var point = $$.d3.mouse(this);
            if ($$.config.onDragStart) $$.config.onDragStart(); // .call? if yes, what scope?
            rect = ($$.config.rectParentNode || node)
                    .append("rect")
                    .attr("x", point[0])
                    .attr("y", point[1])
                    .attr("width", 0)
                    .attr("height", 0)
                    .style("pointer-events", "none")
                    .classed($$.config.rectangleClass, $$.config.rectangleClass ? true : false);
        })
        .on("mousemove", function(d, i, a) {
            if (rect && ($$.d3.select(rect.node)) && !rect.empty()) {
                if ($$.config.preventDragBubbling) pauseEvent($$.d3.event);
                var update = getUpdatedRect($$.d3.mouse(this), rect);
                rect.attr(update);
                if ($$.config.selectNode === "circle") {
                    circleSearch.call($$, targets, update);
                } else if ($$.config.selectNode === "rect") {
                    rectSearch.call($$, targets, update);
                }
                var found = targets.filter("." + $$.config.selectedClass);
                var foundIdx = "";
                found.each(function(d,i) { foundIdx += i; });
                if (currentlyFound !== foundIdx) {
                    $$.config.onSelect.call(found, found);
                    currentlyFound = foundIdx;
                }
            }
        })
        .on("mouseup", function(d, i, a) {
            if (rect) rect.remove();
            rect = null; // setting to null helps us not enter mousemove event's main body after
            if ($$.config.onDragEnd) {
                var selected = node.selectAll($$.config.selectFilter || $$.config.selectNode).filter("." + $$.config.selectedClass);
                $$.config.onDragEnd.call(selected, selected);
            }
        });
    }
    
    function getUpdatedRect(point, rect) {
        var update = {
            x:      parseInt(rect.attr("x"), 10),
            y:      parseInt(rect.attr("y"), 10),
            width:  parseInt(rect.attr("width"), 10),
            height: parseInt(rect.attr("height"), 10)
        },
        movement = {
            x: point[0] - update.x,
            y: point[1] - update.y
        };
        if (movement.x < 1 || movement.x * 2 < update.width) { // did it move right?
            update.x = point[0];
            update.width -= movement.x;
        } else { // else it moved left
            update.width = movement.x;
        }
        if (movement.y < 1 || movement.y * 2 < update.height) { // did it move up?
            update.y = point[1];
            update.height -= movement.y;
        } else { // no, it moved down
            update.height = movement.y;
        }
        return update;
    }
    
    function circleSearch(targetCircles, rect) {
        var $$ = this;
        targetCircles
            .each(function(d, i, a) {
                var thisCircle = $$.d3.select(this);
                if (circleWithinArea({ x: thisCircle.attr("cx"), y: thisCircle.attr("cy"), r: thisCircle.attr("r") }, rect)) {
                    thisCircle.classed($$.config.selectedClass, true);
                } else {
                    thisCircle.classed($$.config.selectedClass, false);
                }
        });
    }
    
    function rectSearch(targetRects, rect) {
        var $$ = this;
        targetRects
            .each(function(d, i, a) {
                var thisRect = $$.d3.select(this);
                if (rectWithinArea({ x: thisRect.attr("x"), y: thisRect("y"), width: thisRect.attr("width"), height: thisRect.attr("height") }, rect)) {
                    thisRect.classed($$.config.selectedClass, true);
                } else {
                    thisRect.classed($$.config.selectedClass, false);
                }
        });
    }
    
    function circleWithinArea(circle, area) {
        var half = { x: area.width/2, y: area.height/2 },
            center = {
            x: circle.x - (area.x+half.x),
            y: circle.y - (area.y+half.y)
        },
            side = {
            x: Math.abs (center.x) - half.x,
            y: Math.abs (center.y) - half.y
        };
        if (side.x >  circle.r || side.y >  circle.r) 
            return false; 
        if (side.x < -circle.r && side.y < -circle.r)
            return true;
        if (side.x < 0 || side.y < 0) 
            return true;
            
        return side.x*side.x + side.y*side.y  < circle.r*circle.r;
    }
    
    function rectWithinArea(rect, area) {
        return rect.x < (area.x + area.width) &&
               (rect.x + rect.width) > area.x &&
               rect.y < (area.y - area.height) &&
               (rect.y - rect.height) > area.y;
    }
    
    function pauseEvent(e){
        if(e.stopPropagation) e.stopPropagation();
        if(e.preventDefault) e.preventDefault();
        e.cancelBubble=true;
        e.returnValue=false;
        return false;
    }
    
    window.d3DragSelector = dragSelector;
    
})(window);