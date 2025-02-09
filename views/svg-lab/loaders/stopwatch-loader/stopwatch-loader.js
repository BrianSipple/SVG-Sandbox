(function (window) {

    // Wire up our references
    var loaderSVG = document.querySelector('#loaderSVG'),
        checkMarkPath = document.querySelector('#checkPath'),
        watchRimBackgroundLayer = document.querySelector('#watchRimBg'),
        watchRimGlow = document.querySelector('#watchRimGlow'),

        clickable = document.querySelector('.click-listener'),

        watchThumbPiecesLayer = document.querySelector('#watchThumbPieces'),
        watchThumbTopBase = document.querySelector('#watchThumbTopBase'),
        watchThumbTopHead = document.querySelector('#watchThumbTopHead'),
        watchThumbSideBase = document.querySelector('#watchThumbSideBase'),
        watchThumbSideHead = document.querySelector('#watchThumbSideHead'),

        watchThumbPieces = [
            watchThumbTopBase,
            watchThumbTopHead,
            watchThumbSideBase,
            watchThumbSideHead
        ],


    // Animate arrow and base into timer center and hand, respectively,
    // when we being the load animation
        centerArrow = document.querySelector('#downloadIconArrow'),
        centerBase = document.querySelector('#downloadIconBase'),

        isAnimating = false,

        ANIMATION_DURATION_MULTIPLIER = 1,

        DURATIONS = {
            makeWatchHand: ANIMATION_DURATION_MULTIPLIER * 0.4,
            makeWatchThumbs: ANIMATION_DURATION_MULTIPLIER * 0.45,
            addRimGlow: ANIMATION_DURATION_MULTIPLIER * 1.1,
            pressThumb: ANIMATION_DURATION_MULTIPLIER * 0.12,
            runWatch: ANIMATION_DURATION_MULTIPLIER * 3.1,
            hideWatchThumbs: ANIMATION_DURATION_MULTIPLIER * 0.2,
            morphHandsToCheck: ANIMATION_DURATION_MULTIPLIER * 1.1
        },

        toggledClasses = {
            animating: 'animating',
            pressThumb: 'press-thumb',
            loadComplete: 'load-complete'
        },

        LABELS = {
            makeWatchHand: 'makeWatchHand',
            makeWatchThumbs: 'makeWatchThumbs',
            addRimGlow: 'addRimGlow',
            pressThumb: 'pressThumb',
            glowComplete: 'glowComplete',
            loadComplete: 'loadComplete'
        },

        tlConfig = {
            repeat: 0, // TODO: Handle resetting the icon at some point?
        },

        masterTl = new TimelineMax(tlConfig);

    TweenMax.set(
        loaderSVG,
        {
            position: 'absolute',
            top: '50%',
            left: '50%',
            yPercent: -50,
            xPercent: -50,
            opacity: 1
        }
    );

    /**
     * Arrow head rotates 180 degrees, scales down, then translates
     * up to form the center node of the watch hand.
     *
     * At the same time, the arrow base will
     * scale down its X-axis to the width of a watch hand.
     */
    function makeHand(duration) {
        var tl = new TimelineMax();

        TweenMax.set([centerBase, centerArrow], {transformOrigin: '50%, 50%'});

        tl.add([
            TweenMax.to(
                centerArrow,
                duration,
                {
                    rotation: 180,
                    scale: 0.5,
                    y: '-=100%',
                    ease: Power3.easeOut
                }
            ),

            TweenMax.to(
                centerBase,
                duration,
                {
                    scaleX: 0.2,
                    y: '-=10%',
                    ease: Power3.easeOut
                }
            )
        ]);

        return tl;
    }

    function setupAnimation() {
        masterTl.set(checkMarkPath, {drawSVG: '58%, 58%'});
    }


    function makeThumbs(duration) {
        var tl = new TimelineMax();
        tl.set(watchThumbPieces, {drawSVG: '0%'});
        tl.set(watchThumbPiecesLayer, {opacity: 1});

        tl.to(
            [watchThumbTopBase, watchThumbSideBase],
            duration / 2,
            {drawSVG: '100%', ease: Linear.easeNone}
        );
        tl.to(
            [watchThumbTopHead, watchThumbSideHead],
            duration / 2,
            {drawSVG: '100%', ease: Back.easeOut.config(1.7)}
        );
        return tl;
    }

    /**
     * Press the top thumb
     */
    function pressThumb(duration) {

        var thumbPressTl = new TimelineMax(),
            boundingRect = watchThumbTopBase.getBoundingClientRect(),
            yDist = boundingRect.top - boundingRect.bottom;

        // simultaneously undraw top thumb base and
        // follow through by down-shifting the thumb head
        thumbPressTl.add([
            TweenMax.to(
                watchThumbTopBase,
                duration * (1/8),
                {
                    drawSVG: '0%'
                }),
            TweenMax.to(watchThumbTopHead, duration, {y: '-=' + yDist})
        ]);

        // restore the thumb
        thumbPressTl.add([
            TweenMax.to(watchThumbTopBase, duration, {drawSVG: '100%'}),
            TweenMax.to(watchThumbTopHead, duration, {y: '+=' + yDist})
        ]);

        return thumbPressTl;
    }

    /**
     * Propagate the glow filter around the watch face.
     */
    function addRimGlow(duration) {

        var rimGlowTl = new TimelineMax();

        rimGlowTl.add(TweenMax.set(watchRimGlow, {drawSVG: '0%'}));
        rimGlowTl.add(TweenMax.set(watchRimGlow, {opacity: 1}));
        rimGlowTl.add(TweenMax.to(watchRimGlow, duration, { drawSVG: '100%'}));
        return rimGlowTl;
    }

    function startWatch(duration, rimGlowTl) {
        var tl = new TimelineMax();

        tl.set(centerBase, {transformOrigin: '50% 90%'});

        tl.add([
            TweenMax.to(centerBase, duration, {
                rotation: 360,
                ease: Linear.easeNone
            }),

            // undraw the glow around the rim
            //TweenMax.to(watchRimGlowLayer, 0.1, {drawSVG: '100% 0%'}),
            //function () { rimGlowTl.reverse(0); }
            TweenMax.to(watchRimGlow, duration, {drawSVG: '0%', ease: Linear.easeNone})


        ]);

        return tl;
    }

    function hideThumbs(duration) {
        var tl = new TimelineMax();

        tl.to([watchThumbSideHead, watchThumbTopHead], duration / 2, {drawSVG: '0%', ease: Power3.easeOut});
        tl.to([watchThumbSideBase, watchThumbTopHead], duration / 2, {drawSVG: '0%', ease: Power3.easeOut});
        tl.set(watchThumbPieces, {opacity: 0, zIndex: -1} );

        return tl;
    }


    /**
     * -- Center node becomes undrawn, hand shrinks to smaller dot and pops up
     * -- Translate dot back down to base of the checkmark and, alas, draw the checkmark
     */
    function morphHandsToCheck(duration) {
        var tl = new TimelineMax();

        tl.add([
            TweenMax.to(
                centerArrow,
                duration * 0.2,
                {
                    opacity: 0,
                    zIndex: -1,
                    ease: Power3.easeOut
                }
            ),

            TweenMax.set(centerBase, {transformOrigin: '50% 90%'}),

            TweenMax.to(
                centerBase,
                duration * 0.2,
                {
                    scaleY: 0.2,
                    ease: Power3.easeOut
                }
            )
        ]);

        tl.add(
            TweenMax.to(centerBase, duration * 0.2, {y: '-=200%', ease: Power3.easeOut })
        );

        tl.add(
            TweenMax.to(
                centerBase,
                duration * 0.2,
                {
                    y: '+=200%',
                    ease: Power3.easeOut,
                    onComplete: function () {
                        TweenMax.set(centerBase, {opacity: 0, zIndex: -1} );
                    }
                }
            )
        );

        // Prepare the checkmark path and then draw it
        tl.set(checkMarkPath, {opacity: 0, drawSVG: '0%', zIndex: 5 } );

        tl.add(
            TweenMax.fromTo(
                checkMarkPath,
                duration * 0.4,
                { opacity: 1, drawSVG: '50% 50%'},  // meet in middle
                {
                    drawSVG: '100%', // draw out from middle
                    onComplete: resetTl
                }
            )
        );
        return tl;
    }

    function animateLoader() {

        var rimGlowTl = addRimGlow(DURATIONS.addRimGlow);
        setupAnimation();
        masterTl.add(makeHand(DURATIONS.makeWatchHand), LABELS.makeWatchHand);
        masterTl.add(makeThumbs(DURATIONS.makeWatchThumbs), LABELS.makeWatchThumbs);
        masterTl.add(rimGlowTl, LABELS.makeWatchThumbs + '+=0.35');
        masterTl.addLabel(LABELS.addRimGlow);
        masterTl.add(pressThumb(DURATIONS.pressThumb), LABELS.addRimGlow + '+=0.35');
        masterTl.addLabel(LABELS.pressThumb);
        masterTl.add(startWatch(DURATIONS.runWatch, rimGlowTl), LABELS.pressThumb + '+=0.1');
        masterTl.addLabel(LABELS.loadComplete);
        masterTl.add(
            [
                hideThumbs(DURATIONS.hideWatchThumbs),
                morphHandsToCheck(DURATIONS.morphHandsToCheck)
            ],
            LABELS.loadComplete + '+=0.2'
        );

    }

    function resetTl () {
        clickable.classList.remove(toggledClasses.animating);
        isAnimating = false;

        // TODO: Return the button to its original state here
    }

    function init() {
        clickable.addEventListener('mouseup', function () {
            if (!isAnimating) {
                isAnimating = true;
                clickable.classList.add(toggledClasses.animating);
                animateLoader();
            }
        }, false);
    }

    window.addEventListener('load', function () {
        init();
    }, false);


}(window));

