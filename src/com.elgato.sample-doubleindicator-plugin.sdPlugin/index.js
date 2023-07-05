/// <reference path="libs/js/stream-deck.js" />
/// <reference path="libs/js/action.js" />
/// <reference path="libs/js/utils.js" />

// Action Cache
const MACTIONS = {};
const cycle = (idx, min, max) => (idx > max ? min : idx < min ? max : idx);

// Action Events
const sampleDoubleIndicatorAction = new Action('com.elgato.sample-doubleindicator.action');

sampleDoubleIndicatorAction.onWillAppear(({context, payload}) => {
    // console.log('will appear', context, payload);
    MACTIONS[context] = new SampleIndicatorAction(context, payload);
});

sampleDoubleIndicatorAction.onWillDisappear(({context}) => {
    // console.log('will disappear', context);
    MACTIONS[context].interval && clearInterval(MACTIONS[context].interval);
    delete MACTIONS[context];
});

sampleDoubleIndicatorAction.onTitleParametersDidChange(({context, payload}) => {
    // console.log('wonTitleParametersDidChange', context, payload);
    MACTIONS[context].color = payload.titleParameters.titleColor;
});

sampleDoubleIndicatorAction.onKeyUp(({context, payload}) => {
    // console.log('onKeyUp', context, payload);
    MACTIONS[context].toggle();
});

sampleDoubleIndicatorAction.onDialRotate(({context, payload}) => {
    // console.log('dial was rotated', context, payload.ticks);
    if(payload.hasOwnProperty('ticks')) {
        MACTIONS[context].manualRotate(payload.ticks);
    }
});

sampleDoubleIndicatorAction.onTouchTap(({context, payload}) => {
    // console.log('touchpanel was tapped', context, payload);
    if(payload.hold === false) {
        MACTIONS[context].toggle();
    }
});

$SD.onConnected(jsn => {
    const [version, major] = jsn.appInfo.application.version.split(".").map(e => parseInt(e, 10));
    const hasDialPress = version == 6 && major < 4;
    if(hasDialPress) {
        sampleDoubleIndicatorAction.onDialPress(({context, payload}) => {
            // console.log('dial was pressed', context, payload);
            if(payload.pressed === false) {
                MACTIONS[context].toggle();
            }
        });
    } else {
        sampleDoubleIndicatorAction.onDialUp(({context, payload}) => {
            console.log('onDialUp', context, payload);
                MACTIONS[context].toggle();
        });
    }
});

class SampleIndicatorAction {
    constructor (context, payload) {
        this.isEncoder = payload.controller === 'Encoder';
        this.context = context;
        this.interval = null;
        this.manualValue = -1;
        if(this.isEncoder) {
            this.width = 100; // default width of the panel is 100
            this.height = 50; // default height of the panel is 50
        } else {
            this.width = 72; // default width of the icon is 72
            this.height = 72; // default width of the icon is 72
        }
        this.numModes = 5;
        this.iconSize = 48; // default size of the icon is 48
        this.color = '#EFEFEF';
        this.mode = 0;
        this.init();
        this.update();
    }

    init() {
        this.interval = setInterval(() => {
            this.update();
        }, 1000);
    }

    toggle() {
        this.mode = (this.mode + 1) % this.numModes; // 0, 1, 2, 3, 4
        this.update();
    }

    manualRotate(ticks) {
        this.mode = this.numModes;
        if(this.manualValue === -1) {
            this.manualValue = Math.floor(100 / 60 * new Date().getSeconds());
        }
        this.manualValue = cycle(this.manualValue + ticks, 0, 100);
        $SD.setFeedback(this.context, {
            title: `${this.manualValue} / ${100 - this.manualValue}`,
            indicator1: this.manualValue,
            indicator2: 100 - this.manualValue
        });
    }

    update() {
        if(this.mode === this.numModes) return; // last mode is manual mode - see above 'manualRotate'
        const indicatorValue = Math.floor(100 / 60 * new Date().getSeconds());
        const reverseMode = this.numModes - this.mode;
        const svg = this.createIcon(this.mode);
        const svg2 = this.createIcon(reverseMode);
        const icon1 = `data:image/svg+xml;,${svg}`;
        const icon2 = `data:image/svg+xml;,${svg2}`;
        if(this.isEncoder) {
            let indicator1 = {
                value: indicatorValue,
                opacity: 1,
                bar_bg_c: null
            };
            let indicator2 = {...indicator1};
            const getFeedbackStyle = (mode, indicatorRef) => {
                if(mode === 1) { // indicator background changes from #ff0000 to #00ff00 with stops at #a6d4ec and #f4b675
                    indicatorRef.bar_bg_c = `0:#ff0000,0.33:#a6d4ec,0.66:#f4b675,1:#00ff00`;
                } else if(mode === 2) { // indicator background changes from #003399 to #00AAFF
                    indicatorRef.bar_bg_c = `0:#003399,1:#00AAFF`;
                } else if(mode === 3) {
                    indicatorRef.bar_bg_c = null; // indicator background reset to default
                } else if(mode === 4) {
                    indicatorRef.opacity = 0.5; // indicator opacity changes to 0.5
                }
            };

            getFeedbackStyle(this.mode, indicator1);
            getFeedbackStyle(reverseMode, indicator2);

            const payload = {
                title: `${indicatorValue} (m:${this.mode} / m:${reverseMode})`,
                indicator1,
                indicator2,
                icon1,
                icon2
            };
            $SD.setFeedback(this.context, payload);
        }
        $SD.setImage(this.context, icon1);
    }

    createIcon(mode) {
        const w = this.iconSize;
        const r = this.iconSize / 2;
        let fontColor = this.color;
        let opacity = mode === 4 ? 0.5 : 1;
        const modeValues = {
            fill: 'none',
            stroke: this.color,
            strokeWidth: 2
        };
        if(mode === 1) {
            modeValues.fill = 'red';
            modeValues.stroke = 'white';
            modeValues.strokeWidth = 0;
        } else if(mode === 2) {
            modeValues.fill = 'blue';
            modeValues.stroke = 'yellow';
            modeValues.strokeWidth = 4;
        } else if(mode === 3 || this.mode === 4) {
            modeValues.fill = 'white';
            modeValues.stroke = 'yellow';
            modeValues.strokeWidth = 1;
            fontColor = 'black';
        }
        
        return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${w}" viewBox="0 0 ${w} ${w}">
        <g opacity="${opacity}">
            <polygon fill="${modeValues.fill}" stroke-width="${modeValues.strokeWidth}" stroke="${this.color}" points="24 36 9.89315394 43.4164079 12.5873218 27.7082039 1.17464361 16.5835921 16.946577 14.2917961 24 0 31.053423 14.2917961 46.8253564 16.5835921 35.4126782 27.7082039 38.1068461 43.4164079"></polygon>
            <text x="${r}" y="${r + r / 3}" text-anchor="middle" fill="${fontColor}" font-size="${r}">${mode}</text>
        </g>
    </svg>`;
    };

};



