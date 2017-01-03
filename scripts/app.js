'use strict';

// console.log(aggregate);
var _aggregate = {};
var _groups = {};

var aggregateService = {
    load: function load() {
        return $.getJSON('data/aggregate.json').success(function (res) {
            console.log('Loaded', res);
            _.merge(_aggregate, res);
        }).error(function (err) {
            console.log('Whoops', err);
        });
    },
    // data: aggregate,
    get data() {
        return _.cloneDeep(_aggregate);
    },
    get groups() {
        return _.cloneDeep(_groups);
    }
    // calculate

};

function Painter(opts) {
    var outputCtx = opts.outputCtx;
    var offscreenEl = opts.offscreenEl;
    // var canvasWidth = opts.width;
    // var canvasHeight = opts.height;
    var brushMasks = opts.brushMasks;
    var invertedBrushMasks;

    // cater for rotation possibly cutting images off
    var CANVAS_PADDING = 20;
    var methods = {
        setup: function setup() {
            // var _this = this;
            // invertedBrushMasks = _.map(brushMasks, function (mask) {
            //     return _this.getInverted(mask, brushOffset, canvasWidth - brushOffset.x * 2, canvasHeight - brushOffset.y * 2);
            // });
            // console.log(invertedBrushMasks);
        },

        // need offscreen canvas per brush to prevent overlapping use
        addCanvas: function addCanvas() {
            var ctx = offscreenEl.append('canvas').attr({
                width: 1,
                height: 1
            }).style({
                // filter: 'hue-rotate(100deg)':
                // position: 'absolute',
                // top: 0,
                // border: '1px solid #000',
                // left: 200,
            }).node().getContext('2d');
            return ctx;
        },

        removeCanvas: function removeCanvas(ctx) {
            ctx.canvas.remove();
        },

        // Written as a promise chain to support Firefox and Safari doing async saving of the canvas
        paint: function paint(brush, onComplete) {
            var ctx = this.addCanvas();
            this.reset(ctx);

            var brushOffset = {
                x: CANVAS_PADDING,
                y: CANVAS_PADDING
            };

            ctx.save();

            var radius = brush.radius;
            var diameter = radius * 2;
            var x = brush.cx - radius;
            var y = brush.cy - radius;
            var hueShift = brush.hueShift;

            var brushIndex = Math.floor(Math.random() * brushMasks.length);

            // var invertedMask = brush.invertedMask;
            var colorTheme = brush.colorTheme;

            var brushWidth = diameter;
            var brushHeight = diameter;
            var canvasWidth = brushWidth + CANVAS_PADDING * 2;
            var canvasHeight = brushHeight + CANVAS_PADDING * 2;

            ctx.canvas.width = canvasWidth;
            ctx.canvas.height = canvasHeight;

            var mask = brushMasks[brushIndex];
            this.reset(ctx);
            this.paintInverted(ctx, mask, brushOffset, brushWidth, brushHeight);

            var invertedMask;
            var base;
            var edge;
            var composite;

            // Draw mask, then fill it with colorTheme
            return this.saveLayer(ctx).then(function (layer) {
                invertedMask = layer;
                this.reset(ctx);

                ctx.save();

                ctx.drawImage(mask, brushOffset.x, brushOffset.y, brushWidth, brushHeight);
                // ctx.restore();
                // ctx.save();

                // hue shifting (only in FF and Chrome, ignored otherwise)
                if (hueShift) {
                    ctx.filter = 'hue-rotate(' + hueShift + 'deg)';
                }
                // color
                ctx.globalCompositeOperation = 'source-atop';
                // var scale = 1.5;
                var colorX = /*-x * scale;//*/-Math.random() * (colorTheme.naturalWidth - brushWidth) + brushOffset.x;
                var colorY = /*-y * scale;//*/-Math.random() * (colorTheme.naturalHeight - brushHeight) + brushOffset.y;

                ctx.drawImage(colorTheme, colorX, colorY, colorTheme.naturalWidth, colorTheme.naturalHeight);
                ctx.globalCompositeOperation = 'source-over';
                ctx.filter = 'none';
                return this.saveLayer(ctx);
            }.bind(this))

            // Result saved as base
            // Draw the inverted mask with a guassian blur for a less hard-edged inner dropshadow
            .then(function (layer) {
                base = layer;
                ctx.globalCompositeOperation = 'source-in';
                this.paintEdge(ctx, invertedMask);
                return this.saveLayer(ctx);
            }.bind(this))

            // result saved as edge
            // draw the edge layer in the mask space
            // so only the shadow portion saves
            .then(function (layer) {
                edge = layer;
                this.reset(ctx);
                ctx.drawImage(mask, brushOffset.x, brushOffset.y, brushWidth, brushHeight);
                ctx.globalCompositeOperation = 'source-in';
                ctx.drawImage(edge, 0, 0, canvasWidth, canvasHeight);
                ctx.globalCompositeOperation = 'source-over';
                return this.saveLayer(ctx);
            }.bind(this))

            // result updates edge layer
            // paint edges onto base brush with an overlay to create watercolour style edging on brush
            .then(function (layer) {
                // update edge
                edge = layer;

                // use full canvas otherwise it scales image down. The full canvas is saved, so draw the full canvas
                ctx.drawImage(base, 0, 0, canvasWidth, canvasHeight);
                ctx.globalCompositeOperation = 'overlay';
                ctx.drawImage(edge, 0, 0, canvasWidth, canvasHeight);
                ctx.globalCompositeOperation = 'source-over';

                return this.saveLayer(ctx);
            }.bind(this))

            // composite saved
            // repaint composite rotated around
            .then(function (layer) {
                composite = layer;

                this.reset(ctx);
                this.paintRotated(ctx, composite);
                return this.saveLayer(ctx);
            }.bind(this))

            // update composite with result
            // paint everything onto output canvas
            .then(function (layer) {
                composite = layer;
                // this.reset(ctx);

                // render
                outputCtx.globalAlpha = brush.opacity || 1;
                outputCtx.globalCompositeOperation = 'multiply';
                outputCtx.drawImage(composite, x - brushOffset.x, y - brushOffset.y, canvasWidth, canvasHeight);
                outputCtx.globalAlpha = 1;
                if (onComplete) {
                    onComplete();
                }
                this.removeCanvas(ctx);
            }.bind(this)).catch(function (e) {
                console.error(e);
            });
        },

        paintRotated: function paintRotated(ctx, img) {
            var canvasWidth = ctx.canvas.width;
            var canvasHeight = ctx.canvas.height;
            ctx.save();
            var angle = Math.random() * 2;

            ctx.translate(canvasWidth / 2, canvasHeight / 2);
            ctx.rotate(angle);
            ctx.drawImage(img, -canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight);

            ctx.restore();
        },

        paintEdge: function paintEdge(ctx, invertedMask) {
            var canvasWidth = ctx.canvas.width;
            var canvasHeight = ctx.canvas.height;
            // ctx
            // ctx.shadowColor = 'rgba(0,0,0,1)';
            // ctx.shadowBlur = 30;
            // ctx.shadowOffsetX = 0;
            // ctx.shadowOffsetY = 0;

            ctx.filter = 'blur(8px)';
            // for (var i = 0; i < 5; i++)
            ctx.drawImage(invertedMask, 0, 0, canvasWidth, canvasWidth);
            ctx.filter = 'none';
            // ctx.shadowColor = 'rgba(0,0,0,0)';
            // ctx.shadowBlur = 0;
            // ctx.shadowOffsetX = 0;
            // ctx.shadowOffsetY = 0;
        },

        saveLayer: function saveLayer(ctx, onSaved) {
            var deferred = Q.defer();
            var layer = document.createElement('img');
            // document.querySelector('body').appendChild(layer);
            layer.onload = function () {
                deferred.resolve(layer);
                // onSaved(layer);
            };
            layer.src = ctx.canvas.toDataURL('image/png');

            return deferred.promise;
        },

        reset: function reset(ctx) {
            this.clear(ctx);
            ctx.shadowColor = 'rgba(0,0,0,0)';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            // ctx.restore();
            ctx.globalCompositeOperation = 'source-over';
        },

        clear: function clear(ctx) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        },

        paintInverted: function paintInverted(ctx, img, brushOffset, brushWidth, brushHeight) {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(img, brushOffset.x, brushOffset.y, brushWidth, brushHeight);
            ctx.globalCompositeOperation = 'source-over';
        }
    };

    var _this = methods;
    _.map(methods, function (fn, name) {
        methods[name] = fn.bind(_this);
    });

    methods.setup();

    return {
        paint: methods.paint
    };
}

function Labeler(opts) {
    var outputEl = opts.outputEl;
    var interactionEl = opts.interactionEl;
    var ctx = opts.ctx;
    var canvasWidth = opts.width;
    var canvasHeight = opts.height;
    var nodes = opts.nodes;
    var labelImages = opts.labelImages;
    // convert labelImages tp data URIs
    //
    // ctx.drawImage(labelImages[0], 0, 0);
    // labelImages[0] = ctx.canvas.toDataURL('image/png');
    // console.log(labelImages[0]);

    var elements = [];

    // cater for rotation possibly cutting images off
    var methods = {
        setup: function setup() {},

        cleanup: function cleanup() {
            _.map(elements, function (el) {
                el.remove();
            });
            elements = [];
        },

        write: function write(opts) {
            var group = opts.group;
            var radius = opts.radius;

            var rotationVariance = 10;
            var variation = 0;
            var yOffset = -radius * 0.75;
            var xOffset = -3;
            var x = Math.round(opts.x + Math.random() * variation - variation / 2 + xOffset);
            var y = Math.round(opts.y + Math.random() * variation - variation / 2 + yOffset);

            var label = this.addLayer(null, 'Label');
            var isFlipped = x > canvasWidth / 2;
            label.setAttribute('style', ['left:' + x + 'px', 'top:' + y + 'px'].join(';'));

            var labelContainer = this.addLayer(label, 'Label-rotate');
            labelContainer.setAttribute('style', ['transform: rotate(' + Math.round(Math.random() * rotationVariance - rotationVariance / 2) + 'deg)'].join(';'));

            var labelBackground = this.addLayer(labelContainer, 'LabelText-background' + (isFlipped ? ' LabelText-background--flip' : ''));

            var labelText = this.addLayer(labelContainer, 'LabelText' + (isFlipped ? ' LabelText--flip' : ''));

            this.addLayer(labelText, 'LabelText-name', group.name);

            var percent = Math.round(group.percent);
            if (percent === 0) {
                percent = 'less than 1%';
            } else {
                percent += '%';
            }
            this.addLayer(labelText, 'LabelText-percent', percent);
            this.addLayer(labelText, 'LabelText-amount', '(' + this.formatMoney(group.amount) + ')');

            this.createInteractionLayer(opts.x, opts.y, radius, label);

            elements.push(label);
            outputEl.appendChild(label);
        },

        createInteractionLayer: function createInteractionLayer(x, y, radius, label) {
            var hitlayer = document.createElement('div');
            hitlayer.setAttribute('class', 'Label-hit');

            hitlayer.setAttribute('style', ['left:' + (x - radius) + 'px', 'top:' + (y - radius) + 'px', 'width:' + radius * 2 + 'px', 'height:' + radius * 2 + 'px'].join(';'));

            interactionEl.appendChild(hitlayer);
            hitlayer.addEventListener('mouseover', function (e) {
                label.setAttribute('class', 'Label Label--show');
            });
            hitlayer.addEventListener('mouseout', function (e) {
                label.setAttribute('class', 'Label Label--hide');
            });
            elements.push(hitlayer);
            // hitlayer.addEventListener('touchstart', function (e) {
            //
            //     label.setAttribute('class', 'Label Label--show');
            // });
            // hitlayer.addEventListener('touchend', function (e) {
            //     label.setAttribute('class', 'Label');
            // });
        },

        formatMoney: function formatMoney(val) {
            val = '' + Math.round(val);
            var rgx = /(\d+)(\d{3})/;
            while (rgx.test(val)) {
                val = val.replace(rgx, '$1' + ',' + '$2');
            }
            return 'R' + val;
        },

        addLayer: function addLayer(parent, className, text) {
            var layer = document.createElement('span');
            layer.setAttribute('class', className);
            if (parent) {
                parent.appendChild(layer);
            }
            if (text) {
                layer.innerHTML = text;
            }
            return layer;
        },

        createDummyText: function createDummyText() {
            // function bboxText( svgDocument, string ) {
            //     var data = svgDocument.createTextNode( string );
            //
            //     var svgElement = svgDocument.createElementNS( svgns, "text" );
            //     svgElement.appendChild(data);
            //
            //     svgDocument.documentElement.appendChild( svgElement );
            //
            //     var bbox = svgElement.getBBox();
            //
            //     svgElement.parentNode.removeChild(svgElement);
            //
            //     return bbox;
            // }
        },

        saveLayer: function saveLayer() {
            var layer = document.createElement('img');
            layer.src = ctx.canvas.toDataURL('image/png');
            return layer;
        },

        clear: function clear() {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
    };

    var _this = methods;
    _.map(methods, function (fn, name) {
        methods[name] = fn.bind(_this);
    });

    methods.setup();

    return {
        write: methods.write,
        cleanup: methods.cleanup
    };
}

var Options = Vue.component('text-input', {
    // inline style needs to be forced for text decoration to handle :visited for some reason
    template: '\n        <div class="TextInput">\n            <label class="TextInput-label">{{label}}</label>\n            <input class="TextInput-field" :type="type" :value="value">\n        </div>\n    ',
    props: ['value', 'type', 'label'],
    data: function data() {
        return {};
    },

    methods: {},
    mounted: function mounted() {}
});

var PaintControls = Vue.component('paint-controls', {
    // inline style needs to be forced for text decoration to handle :visited for some reason
    template: '\n        <div class="PaintControls" :class="{ \'PaintControls--disabled\': !isEnabled }">\n            <a class="Button Button--reset js-reset" :class="{ \'Button--disabled\': !isEnabled }">\n                Paint another\n            </a>\n            <a class="Button Button--download js-download" download="painted-world.png" style="text-decoration:none" :class="{ \'Button--disabled\': !isEnabled }">\n                Download\n            </a>\n            <label class="Checkbox Checkbox--messy"\n                for="messy"\n                :class="{ \'Checkbox--disabled\': !isEnabled }"\n            >\n                <input class="Checkbox-field" type="checkbox" id="messy"\n                    @click="updateMessy"\n                    checked>\n                <span class="Checkbox-box"></span>\n                <span class="Checkbox-label">Messy</span>\n            </label>\n            <label class="Checkbox Checkbox--hue"\n                for="hue"\n                :class="{ \'Checkbox--disabled\': !isEnabled }"\n            >\n                <input class="Checkbox-field" type="checkbox" id="hue"\n                    @click="updateHue"\n                    checked>\n                <span class="Checkbox-box"></span>\n                <span class="Checkbox-label">More colours</span>\n            </label>\n        </div>\n    ',
    props: ['reset', 'download', 'isEnabled', 'ctx'],
    data: function data() {
        return {
            resetBtn: null,
            downloadBtn: null,
            isMessy: true,
            get width() {
                if (!this.ctx) return 0;
                return this.ctx.canvas.width;
            },
            get height() {
                if (!this.ctx) return 0;
                return this.ctx.canvas.width;
            }
        };
    },

    methods: {
        runCb: function runCb(cb) {
            return function () {
                if (this.isEnabled) {
                    cb();
                }
            }.bind(this);
        },
        updateMessy: function updateMessy(e) {
            this.$emit('messy-updated', e.target.checked);
        },
        updateHue: function updateHue(e) {
            this.$emit('hue-updated', e.target.checked);
        }
    },
    mounted: function mounted() {
        this.resetBtn = document.querySelector('.js-reset');
        this.downloadBtn = document.querySelector('.js-download');

        this.resetBtn.addEventListener('mousedown', this.runCb(this.reset));
        this.downloadBtn.addEventListener('mousedown', this.runCb(this.download));
    }
});

// import { colors } from './../../config';
var generateUUID = function generateUUID() {
    var d = new Date().getTime();
    if (window.performance && typeof window.performance.now === "function") {
        d += performance.now(); //use high-precision timer if available
    }
    // var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var uuid = 'axxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : r & 0x3 | 0x8).toString(16);
    });
    return uuid;
};

function organiseCategories(aggregate, isLimited) {
    // var groups = {
    //     'Housing & Utilities': ['Rental', 'Bond repayment', 'Home & garden', 'Home utilities & service'],
    //     'Food': ['Eating out & take outs', 'Groceries'],
    //     'Transportation': ['Transport & fuel', 'Vehicle expenses', 'Vehicle repayments'],
    //     'Investments & RA’s': ['Investments', 'Saving'],
    //     'Entertainment': ['Entertainment', 'Leisure & sport'],
    //     'Healthcare': ['Health & medical'],
    //     'Insurance': ['Insurance'],
    //     'Fashion & Beauty': ['Personal care', 'Clothing  & shoes'],
    //     'Internet & phone': ['Cellphone', 'Internet & phone'],
    //     'Bank Fees & Interest': ['Banks charges & fees'],
    //     'Holidays & travel': ['Holidays & travel'],
    //     'Debt Repayments': ['Card payments', 'Loans'],
    //     'Gifts & Donations':  [ 'Gifts', 'Donations to charity'],
    //     'ATM & Cash': ['ATM & Cash'],
    // };
    // var reversed = {};
    // // rewrite for simpler lookups
    // _.map(groups, function (categories, key) {
    //     _.map(categories, function (cat) {
    //         reversed[cat] = key;
    //     });
    //
    //     return categories;
    //
    // });
    // console.log(JSON.stringify(reversed, null, '    '));

    var categoryLookup = {
        "Rental": "Housing & Utilities",
        "Bond repayment": "Housing & Utilities",
        "Home & garden": "Housing & Utilities",
        "Home utilities & service": "Housing & Utilities",
        "Eating out & take outs": "Food",
        "Groceries": "Food",
        "Transport & fuel": "Transportation",
        "Vehicle expenses": "Transportation",
        "Vehicle repayments": "Transportation",
        "Investments": "Investments & RA’s",
        "Saving": "Investments & RA’s",
        "Entertainment": "Entertainment",
        "Leisure & sport": "Entertainment",
        "Health & medical": "Healthcare",
        "Insurance": "Insurance",
        "Personal care": "Fashion & Beauty",
        "Clothing  & shoes": "Fashion & Beauty",
        "Cellphone": "Internet & phone",
        "Internet & phone": "Internet & phone",
        "Banks charges & fees": "Bank Fees & Interest",
        "Holidays & travel": "Holidays & travel",
        "Card payments": "Debt Repayments",
        "Loans": "Debt Repayments",
        "Gifts": "Gifts & Donations",
        "Donations to charity": "Gifts & Donations",
        "ATM & Cash": "ATM & Cash"
    };
    // var now = moment();
    // TODO start of 12 months ago
    var yearStart = +moment().subtract(12, 'months').startOf('year');
    var groups = {};

    if (isLimited) {
        _.map(aggregate.transactions, function (txn) {
            var group = categoryLookup[txn.categoryName];
            if (txn.spendingGroupName === 'Transfers') {
                return;
            }
            if (!group) {
                group = 'Other';
                // return;
            }
            if (txn.transactionDate < yearStart) {
                return;
            }
            if (!groups.hasOwnProperty(group)) {
                groups[group] = [txn];
            } else {
                groups[group].push(txn);
            }
        });
    } else {
        _.map(aggregate.transactions, function (txn) {
            var group = txn.categoryName;
            if (txn.spendingGroupName === 'Transfers') {
                return;
            }
            if (txn.transactionDate < yearStart) {
                return;
            }
            if (!groups.hasOwnProperty(group)) {
                groups[group] = [txn];
            } else {
                groups[group].push(txn);
            }
        });
    }

    var allGroupsTotal = 0;

    _.map(groups, function (group, name) {
        var total = _.reduce(group, function (subtotal, txn) {
            if (txn.amount.debitOrCredit === 'debit') return subtotal + txn.amount.amount;
            return subtotal;
        }, 0);
        allGroupsTotal += total;
        groups[name] = {
            total: total
        };
    });

    groups = _.filter(groups, function (group, name) {
        group.name = name;
        return group.total > 1;
    });

    _.map(groups, function (group) {
        group.percent = Math.round(group.total / allGroupsTotal * 100);
    });
    // _.map(groups, function (g) {
    //     console.log(g.name, '=', g.percent);
    // });
    // console.log('GROUPS', groups);
    return groups;
}

// Fisher-Yates https://www.frankmitchell.org/2015/01/fisher-yates/
function shuffle$1(array) {
    var i = 0;
    var j = 0;
    var temp = null;

    for (i = array.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}
var INTERACTION_OFFSET_Y = 70;
var PAINT_TIME = 2000;
var PaintedWorld = Vue.component('painted-world', {
    // inline style needs to be forced for text decoration to handle :visited for some reason
    template: '\n        <div class="Painting">\n            <div class="js-painted-world PaintedWorld">\n                <div class="Offscreen js-offscreen"></div>\n                <div class="js-canvas"></div>\n                <paint-controls\n                    :reset="reset"\n                    :download="download"\n                    :isEnabled="canInteract"\n                    :ctx="ctx"\n                    v-on:messy-updated="onMessyUpdated"\n                    v-on:hue-updated="onHueUpdated"\n                >\n                </paint-controls>\n                <div class="js-overlay"></div>\n            </div>\n            <div class="Log js-log"></div>\n        </div>\n    ',
    props: ['data', 'images'],
    data: function data() {
        return {
            graphId: generateUUID(),
            ctx: null,
            labelCtx: null,
            // previewCtx: null,
            canInteract: false,
            // images: {
            //     paintMasks: [],
            //     invertedPaintMasks: [],
            //     labels: [],
            //     colorThemes: [],
            //     canvases: [],
            // },
            painter: null,
            isMessy: true,
            isHueShiftAllowed: true,
            percentLoaded: 0
        };
    },

    methods: {
        onMessyUpdated: function onMessyUpdated(val) {
            this.isMessy = val;
        },

        onHueUpdated: function onHueUpdated(val) {
            console.log('isHueShiftAllowed', val);
            this.isHueShiftAllowed = val;
        },

        reset: function reset() {
            this.createLayout();
            this.paint();
        },

        download: function download(e) {
            var dataUrl = this.ctx.canvas.toDataURL('image/png');
            d3.select('.js-download').attr({
                'href': dataUrl
            });
        },

        setInteractionAllowed: function setInteractionAllowed(isAllowed) {
            this.canInteract = isAllowed;
        },

        paint: function paint() {
            this.setInteractionAllowed(false);
            this.labeler.cleanup();
            var ctx = this.ctx;
            var width = this.width;
            var height = this.height;
            var nodes = this.nodes;

            ctx.clearRect(0, 0, width, height);
            var i = 0;
            var colorIndex = Math.floor(Math.random() * this.images.colorThemes.length);
            var colorTheme = this.images.colorThemes[colorIndex].image;
            var hues = this.images.colorThemes[colorIndex].hues;
            var hueShift = 0;
            if (this.isHueShiftAllowed) {
                hueShift = hues[Math.floor(Math.random() * hues.length)];
            }
            // console.log('nodes', nodes.length);
            var canvasTheme = this.images.canvases[Math.floor(Math.random() * this.images.canvases.length)];
            var count = nodes.length;
            var onCompletePaint = function () {
                if (--count <= 0) {
                    //     ctx.globalCompositeOperation = 'multiply';
                    //     ctx.drawImage(canvasTheme, 0, 0, this.width, this.height);
                    //     ctx.globalCompositeOperation = 'source-over';
                    this.setInteractionAllowed(true);

                    // save to log
                    var imgData = this.ctx.canvas.toDataURL('image/png');
                    var container = d3.select('.js-log').append('div').attr({
                        'class': 'Preview'
                    });

                    container.append('img').attr({
                        src: imgData,
                        'class': 'Preview-image'
                    });
                    container.append('div').attr({
                        'class': 'Preview-stats'
                    }).text('color: ' + (colorIndex + 1) + ', hue: ' + hueShift + 'deg');
                }
            }.bind(this);

            // draw canvas at start so it's not so empty while things process
            this.ctx.drawImage(canvasTheme, 0, 0, this.width, this.height);

            for (i = 0; i < nodes.length; i++) {
                var d = nodes[i];
                setTimeout(function (d) {
                    return function () {
                        this.painter.paint({
                            cx: d.x,
                            cy: d.y,
                            radius: d.r,
                            colorTheme: colorTheme,
                            hueShift: hueShift
                        }, onCompletePaint);

                        this.labeler.write({
                            group: {
                                name: d.name,
                                amount: d.size,
                                percent: d.percent
                            },
                            x: d.x,
                            y: d.y - INTERACTION_OFFSET_Y,
                            radius: d.r
                        });
                    };
                }(d).bind(this), Math.random() * PAINT_TIME);
                // console.log('loading', Math.floor((i + 1) / nodes.length  * 100));
            }
            if (this.isMessy) {
                this.speckleCanvas(colorTheme, hueShift);
            }
        },

        speckleCanvas: function speckleCanvas(colorTheme, hueShift) {
            var numSplatters = Math.floor(Math.random() * 40) + 5;
            for (var i = 0; i < numSplatters; i++) {
                setTimeout(function () {
                    var size = Math.random() * 6 + 1;

                    this.painter.paint({
                        cx: Math.random() * this.width,
                        cy: Math.random() * this.height,
                        radius: size,
                        hueShift: hueShift,
                        colorTheme: colorTheme,
                        opacity: size < 3 ? Math.random() * 0.3 + 0.5 : Math.random() * 0.3 + 0.1
                    });
                }.bind(this), Math.random() * PAINT_TIME / 2);
                // console.log('loading', Math.floor((i + 1) / nodes.length  * 100));
            }
        },

        createLayout: function createLayout() {
            var PACK_PADDING = 30;
            var PADDING = 80;
            var width = this.width;
            var height = this.height;
            var groups = organiseCategories(aggregateService.data, false);
            var data = {
                name: 'root',
                children: _.map(groups, function (group, i) {
                    var node = {};
                    node.name = group.name;
                    node.size = group.total;
                    node.percent = group.percent;
                    node.offset = {
                        angle: Math.random() * Math.PI * 2
                    };
                    return node;
                })
            };
            shuffle$1(data.children);

            var nodes = d3.layout.pack().sort(null)
            // .shuffle()//(a,b)=>b.size-a.size)
            .size([width - PADDING * 2, height - PADDING * 2]).padding(PACK_PADDING).value(function (d) {
                return d.size;
            }).nodes(data);

            // remove root
            _.remove(nodes, { name: 'root' });

            // offset the circle within padded area for more randomness
            var getPosition = function getPosition(d, axis) {
                var trig = Math.sin;
                if (axis === 'x') trig = Math.cos;
                return d[axis] + PACK_PADDING * 0.3 * trig(d.offset.angle);
            };
            _.map(nodes, function (node) {
                node.x = getPosition(node, 'x') + PADDING;
                node.y = getPosition(node, 'y') + PADDING;
            });
            this.nodes = nodes;
        },

        setup: function setup() {

            var target = this.target;
            var width = 900; //document.documentElement.clientWidth - margin.left - margin.right;
            var height = 800;

            var paintedWorld = d3.select('.js-painted-world');
            var canvasContainer = paintedWorld.select('.js-canvas');
            var overlayContainer = paintedWorld.select('.js-overlay');
            var offscreenContainer = paintedWorld.select('.js-offscreen');

            var dom = canvasContainer.append('canvas').attr({
                width: width,
                height: height
            }).style({
                position: 'absolute',
                top: 0,
                left: 0
            }).node().getContext('2d');

            // var previewCtx = canvasContainer
            //     .append('canvas')
            //         .attr({
            //             width: width,
            //             height: height,
            //         })
            //         .style({
            //             position: 'absolute',
            //             top: 0,
            //             left: 0,
            //             'mix-blend-mode': 'multiply',
            //         })
            //         .node().getContext('2d');

            var labelEl = overlayContainer.append('div').attr({}).style({
                position: 'absolute',
                top: INTERACTION_OFFSET_Y + 'px',
                left: 0,
                // border: '1px solid #000',
                width: width + 'px',
                height: height - INTERACTION_OFFSET_Y + 'px'
            }).node();
            var labelInteractionEl = overlayContainer.append('div').attr({}).style({
                position: 'absolute',
                top: INTERACTION_OFFSET_Y + 'px',
                left: 0,
                // border: '1px solid #0c0',
                width: width + 'px',
                height: height - INTERACTION_OFFSET_Y + 'px'
            }).node();

            var offscreenEl = offscreenContainer.append('div').style({
                position: 'absolute',
                top: 0,
                left: width + 'px'
            });
            //     .append('canvas')
            //         .attr({
            //             width: width,
            //             height: height,
            //         })
            //         .style({
            //             position: 'absolute',
            //             top: 0,
            //             // border: '1px solid #000',
            //             // left: 200,
            //         })
            //         .node().getContext('2d');
            var offscreenLabelCtx = offscreenContainer.append('canvas').attr({
                width: width,
                height: height
            }).style({
                position: 'absolute',
                bottom: 0
            }).node().getContext('2d');

            this.width = width;
            this.height = height;
            this.ctx = dom;
            // this.previewCtx = previewCtx;
            // this.offscreenCtx = offscreenCtx;

            this.painter = new Painter({
                outputCtx: dom,
                offscreenEl: offscreenEl,
                width: width,
                height: height,
                brushMasks: this.images.paintMasks
            });

            this.labeler = new Labeler({
                outputEl: labelEl,
                ctx: offscreenLabelCtx,
                interactionEl: labelInteractionEl,
                width: width,
                height: height,
                labelImages: this.images.labels
            });
        }

    },
    mounted: function mounted() {
        // var data = this.data;
        // console.log(data);
        // this.loadAll();

        this.setup();
        this.createLayout();
        this.paint();
    }
});

var AssetLoader = Vue.component('asset-loader', {
    // inline style needs to be forced for text decoration to handle :visited for some reason
    template: '\n        <div>\n            <div class="AssetLoader" v-if="!isLoaded">\n                <div>Loading... </div>\n                <div>{{percentLoaded}}%</div>\n            </div>\n\n            <painted-world v-if="isLoaded"\n                :images="images"\n            ></painted-world>\n        </div>\n    ',
    props: [],
    data: function data() {
        return {
            isLoaded: false,
            percentLoaded: 0,
            images: {
                paintMasks: [],
                invertedPaintMasks: [],
                labels: [],
                colorThemes: [],
                canvases: []
            }
        };
    },

    methods: {
        createLayout: function createLayout() {
            var PACK_PADDING = 30;
            var PADDING = 80;
            var width = 500;
            var height = 500;
            var groups = d3.range(20).map(function () {
                return {
                    name: group.name,
                    size: group.total
                };
            });
            var data = {
                name: 'root',
                children: groups
            };
            shuffle(data.children);

            var nodes = d3.layout.pack().sort(null)
            // .shuffle()//(a,b)=>b.size-a.size)
            .size([width - PADDING * 2, height - PADDING * 2]).padding(PACK_PADDING).value(function (d) {
                return d.size;
            }).nodes(data);

            // remove root
            _.remove(nodes, { name: 'root' });

            // offset the circle within padded area for more randomness
            var getPosition = function getPosition(d, axis) {
                var trig = Math.sin;
                if (axis === 'x') trig = Math.cos;
                return d[axis] + PACK_PADDING * 0.3 * trig(d.offset.angle);
            };
            _.map(nodes, function (node) {
                node.x = getPosition(node, 'x') + PADDING;
                node.y = getPosition(node, 'y') + PADDING;
            });

            return nodes;
        },

        draw: function draw(nodes) {
            for (i = 0; i < nodes.length; i++) {
                var d = nodes[i];
            }
        },

        loadImage: function loadImage(path, cb) {
            var deferred = Q.defer();
            var img = new Image(); // Create new img element
            img.addEventListener("load", function () {
                if (cb) cb();
                deferred.resolve(img);
            }.bind(this), false);
            img.src = './images/' + path;
            return deferred.promise;
        },

        trackProgress: function trackProgress(numAssets, onUpdate) {
            var loadCount = 0;
            var percentLoaded = 0;
            return function () {
                loadCount++;
                onUpdate(loadCount / numAssets);
            }.bind(this);
        },

        onUpdateMain: function onUpdateMain(percent) {
            this.percentLoaded = Math.floor(percent * 100);
            console.log('p', this.percentLoaded);
        },

        loadAll: function loadAll() {
            var imagesToLoad = [
            // canvases
            'canvases/canvas1.jpg', 'canvases/canvas2.jpg', 'canvases/canvas3.jpg', 'canvases/canvas4.jpg',

            // themes
            'colors/color1.jpg', 'colors/color2.jpg', 'colors/color3.jpg',
            // 'colors/color4.jpg'), // pure flat color for debg

            // labels
            // 'label/label1.png',
            // 'label/label2.png',
            // 'label/label3.png',
            // 'label/label4.png',
            // 'label/label5.png',
            'label.png',

            // brushes
            'brushes/outline01.png', 'brushes/outline02.png', 'brushes/outline03.png', 'brushes/outline04.png', 'brushes/outline05.png', 'brushes/outline06.png', 'brushes/outline07.png', 'brushes/outline08.png', 'brushes/outline09.png', 'brushes/outline10.png', 'brushes/outline11.png', 'brushes/outline12.png', 'brushes/outline13.png', 'brushes/outline14.png', 'brushes/outline15.png', 'brushes/outline16.png'];

            var onProgress = this.trackProgress(imagesToLoad.length, this.onUpdateMain);

            var promise = Q.all(_.map(imagesToLoad, function (path) {
                return this.loadImage(path, onProgress);
            }.bind(this))).then(function (images) {
                // console.log('done', images);
                var i = 0;
                var incr = 4;
                for (i = 0; i < incr; i++) {
                    this.images.canvases.push(images[i]);
                }
                incr = 3;
                var num = i + incr;
                for (; i < num; i++) {
                    var hues = [];
                    switch (i - num + incr) {
                        case 0:
                            hues = [0, -70, 180];
                            break;
                        case 1:
                            hues = [0, -130, -65];
                            break;
                        case 2:
                            hues = [0, 180, 20];
                            break;
                    }
                    this.images.colorThemes.push({
                        image: images[i],
                        hues: hues
                    });
                }
                incr = 1;
                var num = i + incr;
                for (; i < num; i++) {
                    this.images.labels.push('images/label.png');
                    // this.images.labels.push(images[i]);
                }
                for (; i < images.length; i++) {
                    this.images.paintMasks.push(images[i]);
                }
                return true;
            }.bind(this)).then(this.onComplete).catch(function (e) {
                console.error(e);
            });

            return promise;
        },
        onComplete: function onComplete() {
            this.isLoaded = true;
        }
    },
    mounted: function mounted() {
        this.loadAll();
    }
});

var GraphScreen = Vue.component('graph-screen', {
    template: '\n        <asset-loader></asset-loader>\n    ',
    props: [],
    data: {},
    methods: {}
});

// import { DashboardItem } from './dashboard-item';

var LoginScreen = Vue.component('login-screen', {
    template: '\n        <div>\n            <input placeholder="email" v-model="email">\n            <input placeholder="password" type="password" v-model=">\n        </div>\n    ',
    props: [],
    data: {},
    methods: {}
});

Vue.use(VueRouter);

var routes = [{ name: 'login', path: '/', component: LoginScreen }, { name: 'graph', path: '/graph', component: GraphScreen }];

routes = routes.map(function (route) {
    route.beforeEnter = function (to, from, next) {
        window.scroll(0, 0);
        next();
    };
    return route;
});

var router = new VueRouter({
    routes: routes
});

var formatNumber = function formatNumber(value) {
    if (typeof value === 'undefined') return 0;
    value = Math.round(value);
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

Vue.filter('number', function (value) {
    return formatNumber(value);
});

Vue.filter('currency', function (value) {
    return 'R' + formatNumber(value);
});

Vue.filter('date', function (value) {
    return moment(value).format('D MMMM YYYY');
});
Vue.filter('dateAgo', function (value, hideAgo) {
    return moment(value).fromNow(hideAgo);
});

//
Vue.filter('fuzzyDatePeriod', function (value, periodType) {
    var response = '';
    switch (periodType) {
        case 'year':
        case 'years':
        case 'y':
            var years = Math.floor(value);
            var months = Math.round((value - years) * 12);

            if (years > 0) {
                response += years + ' year' + (years !== 1 ? 's' : '');
            }
            if (months > 0) {
                if (years > 0) {
                    response += ' and ';
                }
                response += months + ' month' + (months !== 1 ? 's' : '');
            }
            // response = response.replace(/ /g, '&nbsp;');
            return response;
            break;
    }
});

// export {};

aggregateService.load().success(function (res) {
    new Vue({
        router: router,
        el: '.App',
        data: {},
        created: function created() {
            router.push({ name: 'graph' });
        }
    });
});