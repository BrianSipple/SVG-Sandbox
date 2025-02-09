var app = (function (exports) {
    
    'use strict';
    
    var 
        SELECTORS = {
            clockSVG: '#Clock',
            clockBodySVG: '#ClockBody',
            clockFaceSVG: '#ClockFace',
            tailSVG: '#Tail',
            leftEyeSVG: '#EyeLeft',
            leftEyelidSVG: '#EyelidLeft',
            rightEyeSVG: '#EyeRight',
            rightEyelidSVG: '#EyelidRight',
            hourHandSVG: '#HourHand',
            minuteHandSVG: '#MinuteHand',
            hourHandBaseSVG: '#HourHandBase',
            minuteHandBaseSVG: '#MinuteHandBase'
        },
            
        clockSVG = document.querySelector(SELECTORS.clockSVG),
        clockBodySVG = clockSVG.querySelector(SELECTORS.clockBodySVG),
        clockFaceSVG = clockSVG.querySelector(SELECTORS.clockFaceSVG),
        tailSVG = clockSVG.querySelector(SELECTORS.tailSVG),
        leftEyeSVG = clockSVG.querySelector(SELECTORS.leftEyeSVG),
        leftEyelidSVG = clockSVG.querySelector(SELECTORS.leftEyelidSVG),
        rightEyeSVG = clockSVG.querySelector(SELECTORS.rightEyeSVG),
        rightEyelidSVG = clockSVG.querySelector(SELECTORS.rightEyelidSVG),
        hourHandSVG = clockSVG.querySelector(SELECTORS.hourHandSVG),
        hourHandBaseSVG = clockSVG.querySelector(SELECTORS.hourHandBaseSVG),
        minuteHandSVG = clockSVG.querySelector(SELECTORS.minuteHandSVG),
        minuteHandBaseSVG = clockSVG.querySelector(SELECTORS.minuteHandBaseSVG),
        
                    
        
        // Use to prevent ugly timing behavior
        MAX_FRAME_DELTA = 0.050,
        
        
        //////////////////////// Animation variables ////////////////////////
        
        // Timing
        previousTime = new Date(),
        currentTimeZone,
        currentTimeZoneOffsetMins,
        currentTime,
        elapsedTimeMS,
        
        // Pendulum
        newPerpendicularForceOnPendulum,
        newPendulumTorque,
        newPendulumAcceleration,        
        
        
        //////////////////////// Models ////////////////////////
                    
        PendulumObjectProto = {
            el: undefined,
            pos: {
                cx: 0
            },
            mass: 1,    
            length: 0,
            width: 0,
            theta: 0, // 0 ===> Horizontal and pointing to the right. Math.PI / 2 ==> pointing straight down,
            omega: 0,
            alpha: 0,
            J: 0,
            
            initFromSVGs: function initFromSVGs (svgElem, containerSVGElem) {
                //debugger;
                
                var 
                    boundingRect = svgElem.getBoundingClientRect(),
                    containerBoundingRect = containerSVGElem.getBoundingClientRect();
        
                this.el = svgElem;
                this.length = boundingRect.height;
                this.width = boundingRect.width;
                this.pos.cx = boundingRect.left + ( (boundingRect.right - boundingRect.left) / 2);
                
                this.swingSpan = containerBoundingRect.width;
                this.J = this.mass * (this.length * this.length);  // moment of inertia
            },
            
            /**
             * Computes the new state of the pendulum (at the current frame) by
             * using the Velocity Verlet Algorithm -- where velocity and position are 
             * BOTH calculated relative to time.
             */
            updateState: function updateState (elapsedTimeMS) {
                //debugger;
                var deltaT = elapsedTimeMS / 1000;  // MS to seconds
                deltaT = adjustDeltaToHandleCrazyTimeWarping(deltaT);

                this.theta += this.omega * deltaT + (0.5 * this.alpha * deltaT * deltaT);

                /**
                 * Calculate forces from current position. 
                 * 
                 * 1) Perpendicular force is computed by 
                 * taking the [mass] * [gravity due to Earth (9.81 m/s^2)] * [length]
                 * 2) Torque is the perpendicular force multiplied by distance from center of rotation
                 */
                newPerpendicularForceOnPendulum = this.mass * 9.81 * Math.cos(this.theta) * this.length;
                newPendulumTorque = newPerpendicularForceOnPendulum * this.length;

                newPendulumAcceleration = newPendulumTorque / this.J;

                /* Calculate current angular velocity from last frame's ang. velocity and 
                average of last frame's acceleration with this frame's acceleration. */
                this.omega += 0.5 * (newPendulumAcceleration + this.alpha) * deltaT;

                /* Update acceleration */
                this.alpha = newPendulumAcceleration;  
                
//                console.log('Elapsed Time: ' + elapsedTimeMS);
//                console.log('DeltaT: ' + deltaT);
//                console.log('Theta: ' + this.theta);
//                console.log('Omega: ' + this.omega);
//                console.log('Alpha: ' + this.alpha);
//                console.log('Torque: ' + newPendulumTorque);
            },
            
            animate: function animate () {
                //debugger;
                            
                // Subtract an extra PI/2 to account for the fact that we start in the downward (PI/2 rad) postion 
                var rotation = (this.theta - (Math.PI / 2)) / 2;
                
                if (this.maxTheta) {
                    rotation = this.maxTheta * -Math.cos(this.theta);
                }
                                                   
                var newXOffset = (this.width/2) + (this.length * Math.cos(this.theta));
                
                // Handle cases where we're bounding the x offset
                if (this.maxXOffset) {                    
                    newXOffset = this.maxXOffset * Math.cos(this.theta);
                }
                                                
                // update the state -- then set it on the element
                this.pos.cx += newXOffset;
                
                
                //console.log('New X Offset: ' + newXOffset);
                
                
                this.el.style.transform = 
                    'translateX(' + newXOffset + 'px) ' +
                    'rotateZ(' + rotation + 'rad)';
            }        
        },
                        
        Pendulum = Object.create(PendulumObjectProto),
        LeftEyelid = Object.create(PendulumObjectProto),
        RightEyelid = Object.create(PendulumObjectProto),
        
        
        ClockHandProto = {
            el: undefined,
            clockBaseEl: undefined,
            semiMajorAxisLength: 0,
            semiMinorAxisLength: 0,
            currentTimeStamp: undefined,
            theta: Math.PI / 2, // (Math.PI / 2 ==> 3:00 , Math.PI == 6:00)
            
            initFromSVGs: function initFromSVGs (mainSVG, clockBaseSVG, clockFaceSVG) {
              
                this.el = mainSVG;
                this.clockBaseEl = clockBaseSVG;
                
                var 
                    clockFaceRect = clockFaceSVG.getBoundingClientRect(),
                    clockFaceHeight = clockFaceRect.height,
                    clockFaceWidth = clockFaceRect.width;
                
                if (clockFaceHeight >= clockFaceWidth) {
                    this.semiMajorAxisLength = clockFaceHeight;
                    this.semiMinorAxisLength = clockFaceWidth;
                    
                } else {
                    this.semiMajorAxisLength = clockFaceWidth;
                    this.semiMinorAxisLength = clockFaceHeight;
                }
                                                        
                var yTransOriginPercentage = 
                    100 - ( Number(this.clockBaseEl.getAttribute('r')) / this.el.getBBox().height );
                            
                this.el.style.transformOrigin = ('50% ' + yTransOriginPercentage + '%');
            },
            
            animate: function animate () { 
                
                var thetaAdjustmentFactor = 1;
                
                // TODO: Compute proper rotation adjustment for angles on an elipse.
                
//                    ( 1 - (this.theta * (Math.PI / 2) ) ) * (this.semiMajorAxisLength / this.semiMinorAxisLength);
//                    (   
//                        this.theta * ( (Math.PI / 2) / (this.semiMajorAxisLength / this.semiMinorAxisLength) ) * 
//                        Math.PI/2
//                    );
                
                debugger;                                
                this.el.style.transform = 'rotateZ(' + (this.theta * thetaAdjustmentFactor) + 'rad)';
            }
            
        },
        
        HourHand = Object.create(ClockHandProto),    
        MinuteHand = Object.create(ClockHandProto);

        
    
    function computeHourHandTheta (time) {
        
        var 
            hours = time.getHours(),
            minutes = time.getMinutes(),
            seconds = time.getSeconds(),
            
            theta = ( (hours % 12) + (minutes / 60) + (seconds / 3600) ) 
                * 30 
                * (Math.PI / 180);
                //- Math.PI / 2;
        
        return theta;
    }
    
    function computeMinuteHandTheta (time) {
        debugger;
        var 
            minutes = time.getMinutes(),
            seconds = time.getSeconds(),
        
            theta = ( (minutes + (seconds / 60)) / 60 ) * (Math.PI * 2);
        
        console.log('New minute hand theta: ' + theta);
        return theta;
    }
    
    function computeClockHandThetas (time) {        
        HourHand.theta = computeHourHandTheta(time); 
        HourHand.currentTimeStamp = time;
        
        MinuteHand.theta = computeMinuteHandTheta(time);        
        MinuteHand.currentTimeStamp = time;
    }
    
    function performPendulumAnimations () {
        [
            Pendulum,
            LeftEyelid,
            RightEyelid
        ]
        .forEach(function (obj) {
            obj.animate();
        });
    }
    
    function rotateClockHands () {        
        [
            HourHand,
            MinuteHand
        ]
        .forEach(function (hand) { 
            hand.animate();            
        });
    }
    
    
    function animateElements () {        
        performPendulumAnimations();
        rotateClockHands();
    }
    
    
    /** 
     *    When switching away from the window, 
     *    requestAnimationFrame is paused. Switching back after a long
     *    duration will cause us to compute a giant deltaT.
     *    
     *    To ensure that the universe remains in alignment 
     *    we'll bound deltaT to 50ms.
     */
    function adjustDeltaToHandleCrazyTimeWarping(currentDelta) {        
        if (currentDelta > MAX_FRAME_DELTA) {
            return MAX_FRAME_DELTA;
        } else {
            return currentDelta;
        }
    }
    
    
    function computePendulumStates (elapsedTimeMS) {
        [
            Pendulum,
            LeftEyelid,
            RightEyelid
        ]
        .forEach(function (obj) {
            obj.updateState(elapsedTimeMS);
        });
    }
    
    function initPendulumObjects () {
        Pendulum.initFromSVGs(tailSVG, clockBodySVG);
        LeftEyelid.initFromSVGs(leftEyelidSVG, leftEyeSVG);
        RightEyelid.initFromSVGs(rightEyelidSVG, rightEyeSVG);
    }
    
    function initClockHands () { 
        HourHand.initFromSVGs(hourHandSVG, hourHandBaseSVG, clockFaceSVG);
        MinuteHand.initFromSVGs(minuteHandSVG, minuteHandBaseSVG, clockFaceSVG);        
    }
    
    
    /**
     * We want to apply pendulum-swing physics to the horizontal sweeping
     * motion of the eyelid, but restrict its angle to a tighter span
     * due to the nature of its position / alignment within the eyeball
     */
    function restrictEyelidMotion (thetaLimit, xOffsetLimit) {
        RightEyelid.maxTheta = thetaLimit;
        RightEyelid.maxXOffset = xOffsetLimit;
        
        LeftEyelid.maxTheta = thetaLimit;
        LeftEyelid.maxXOffset = xOffsetLimit;
    }
                
    function runTheClock () {
                
        requestAnimationFrame(runTheClock);
        
        currentTime = new Date();
        elapsedTimeMS = currentTime.getTime() - previousTime.getTime();  // elapsed time in ms b/w frames
        previousTime = currentTime;
        
        computePendulumStates(elapsedTimeMS);
        computeClockHandThetas(currentTime);
        animateElements();                                        
    }
        
    
    function init () {                                
        initPendulumObjects();        
        restrictEyelidMotion(Math.PI/20, LeftEyelid.swingSpan / 4.75);
        initClockHands();
        computeClockHandThetas(previousTime);
        runTheClock();
    }
    
    return {
        init: init
    };
    
}(window));

window.addEventListener('DOMContentLoaded', app.init, false);