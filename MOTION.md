# Motion sources

The app uses the free tabs-sliding, accordion, checkbox-check, and toast recipes from [transitions.dev](https://transitions.dev). Their CSS and per-recipe variables are copied verbatim into `motion.css`; `styles.css` provides the app colors and dimensions. `motion.js` adapts the documented tab and accordion orchestration to the existing vanilla JavaScript interface. Native checkboxes remain the accessible inputs, with decorative animated SVG checks.

Source: https://github.com/Jakubantalik/transitions.dev/tree/598d3d6ad89dabb4bdf742fd2e887ca53914a888/cli/free

Usage terms: https://transitions.dev/terms.html

The recipes retain their reduced-motion guards. Accordion content becomes inert when closed, tab positioning updates on resize/font load, and toast motion uses different entry and exit durations. No paid recipes or runtime dependencies are included.
