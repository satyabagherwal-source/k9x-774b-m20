# Forensic Learning Record (Deep Inspection): elrumordelaluz/reactour

> **Canonical Artifact**: `07_PROJECT_LEARNING/elrumordelaluz-reactour-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/elrumordelaluz/reactour](https://github.com/elrumordelaluz/reactour))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:33:46.253Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `elrumordelaluz/reactour`
- **Description**: Tourist Guide into your React Components
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4089 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/web/.eslintrc.js`
```
module.exports = require('@reactour/config/eslint-preset')

```

### Core Architecture Module: `apps/web/components/Box.tsx`
```
import styled from '@emotion/styled'

type BoxProps = {
  center?: boolean
  align?: string
  width?: string
}

export default styled.div<BoxProps>`
  flex: 0 0 100%;
  padding: 1em;
  text-align: ${(props) =>
    props.center ? 'center' : props.align ? props.align : 'left'};
  @media (min-width: 40em) {
    flex: ${(props) => (props.width ? `0 0 ${props.width}` : 1)};
    width: ${(props) => (props.width ? props.width : '100%')};
  }
`

```

### Core Architecture Module: `apps/web/components/Button.tsx`
```
import styled from '@emotion/styled'

import { fontFamily, headingSizes, themeColors } from './settings'

type ButtonProps = {
  h?: string
  color?: 'dark' | 'light' | 'black' | 'white'
  bg?: 'dark' | 'light' | 'black'
  width?: string
  nospaces?: boolean
  onClick?: () => void
}

const styles = `
    border: 0;
    border-radius: 4px;
    color: white;
    padding: .5em 1em;
    font-family: ${fontFamily};
    margin-left: .25em;
    margin-right: .25em;
`
const Button = styled.button<ButtonProps>`
  ${styles};
`
const Link = styled.a<ButtonProps>`
  ${styles};
`

const StyledButton = styled(Button)`
  font-size: ${(props) =>
    props.h
      ? props.h
        ? headingSizes[Number(props.h) - 1]
        : 'inherit'
      : 'inherit'};
  background-color: ${(props) =>
    props.color ? themeColors[props.color] : themeColors.dark};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  outline: ${(props) => (props.disabled ? '2px solid black' : 1)};
`

const StyledLink = styled(Link)`
  text-decoration: none;
  font-size: ${(props) =>
    props.h ? headingSizes[Number(props.h) - 1] : 'inherit'};
  background: ${(props) => (props.bg ? themeColors[props.bg] : 'none')};
  color: ${(props) =>
    props.bg
      ? 'white'
      : props.color
        ? themeColors[props.color]
        : themeColors.black};
  ${(props) =>
    props.nospaces &&
    `
    display: inline-block;
    padding: 0;
    margin: 0;
  `};
`

export { StyledButton as Button }
export { StyledLink as Link }

```

### Core Architecture Module: `apps/web/components/Dropdown.js`
```
import { useState } from 'react'
import styled from '@emotion/styled'
import { fontFamily, headingSizes, themeColors } from './settings'

const DropdownWrapper = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
`

const DropdownContent = styled.div`
  position: absolute;
  background-color: white;
  padding: 15px;
  box-shadow: 0 0 3px 0 rgba(0, 0, 0, 0.75);
  color: black;
  font-family: ${fontFamily};
  font-size: 14px;
  line-height: 1.5;
  right: 0;
  top: 40px;
  border-radius: 5px;
  text-align: left;
  width: 300px;
`

const DropdownTrigger = styled.div`
  border-radius: 50%;
  background-color: ${themeColors.light};
  color: white;
  font-size: ${headingSizes[3]};
  display: inline-block;
  width: ${headingSizes[1]};
  height: ${headingSizes[1]};
  text-align: center;
  margin-left: 5px;
  cursor: pointer;
`

export default function Dropdown({ children }) {
  const [visible, setVisible] = useState(false)

  return (
    <DropdownWrapper>
      <DropdownTrigger onClick={() => setVisible(!visible)}>?</DropdownTrigger>
      {visible && (
        <DropdownContent data-tut="reactour__highlighted-absolute-child">
          {children}
        </DropdownContent>
      )}
    </DropdownWrapper>
  )
}

```

### Core Architecture Module: `apps/web/components/Footer.js`
```
import styled from '@emotion/styled'
import { themeColors } from './settings'

export default styled.footer`
  width: 100%;
  background-color: ${themeColors.light};
  text-align: center;
  padding-bottom: 3em;
  padding-top: 1em;
`

```

### Core Architecture Module: `apps/web/components/Heading.js`
```
import styled from '@emotion/styled'
import { fontFamily, headingSizes, themeColors } from './settings'

export default styled(({ h, ...props }) => {
  const H = `h${h}`
  return <H {...props} />
})`
  font-size: ${(props) => headingSizes[props.h - 1]};
  font-family: ${fontFamily};
  font-weight: 300;
  color: ${(props) => themeColors[props.color] || themeColors.dark};
  letter-spacing: 1px;
  line-height: 1.375;
`

```

### Core Architecture Module: `apps/web/components/Home.tsx`
```
import { useEffect, useContext } from 'react'
import { useTour } from '@reactour/tour'
import { ModalContext } from 'modaaals'
import Section from './Section'
import Logo from './Logo'
import Text from './Text'
import Heading from './Heading'
import Row from './Row'
import Box from './Box'
import Scrollable from './Scrollable'
import Footer from './Footer'
import Image from './Image'
import { Button, Link } from './Button'
import Dropdown from './Dropdown'
import ImagesRow from './ImagesRow'
import Tabs from './Tabs'
import { tourConfig, tourConfigAlt } from './config'

export default function Home() {
  const { setIsOpen, setSteps, setMeta, meta, setCurrentStep } = useTour()
  const { openModal } = useContext(ModalContext)

  useEffect(() => {
    function keyHandling(e: KeyboardEvent) {
      if (e.keyCode === 75) {
        e.preventDefault()
        setIsOpen(true)
      }
    }
    window.addEventListener('keyup', keyHandling)
    return () => window.removeEventListener('keyup', keyHandling)
  }, [setIsOpen])

  return (
    <>
      <Section center classic>
        <Logo />
        <Heading h="3" data-tut="reactour__copy">
          Tourist Guide into your React Components
        </Heading>
      </Section>

      <Section
        classic
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          zIndex: 9999999,
        }}
      >
        <Button
          h="6"
          onClick={() => {
            setMeta('tour-1')
            setSteps(tourConfig)
          }}
          disabled={meta === 'tour-1'}
        >
          Steps 1
        </Button>
        <Button
          h="6"
          onClick={() => {
            setMeta('tour-2')
            setSteps(tourConfigAlt)
            setCurrentStep(0)
          }}
          disabled={meta === 'tour-2'}
        >
          Steps 2
        </Button>
      </Section>
      <Section center classic sticky>
        <Button h="4" onClick={() => setIsOpen(true)}>
          Try it
        </Button>
        <Link
          h="4"
          target="_blank"
          rel="noopener noreferrer"
          href="https://docs.reactour.dev"
        >
          Docs
        </Link>
        <Link
          h="4"
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/elrumordelaluz/reactour"
        >
          Github
        </Link>
      </Section>
      <Section>
        <Row>
          <Box center width="100%">
            <Heading h="1">Expedition into the awesome wildlife</Heading>
            <Heading
              data-tut="reactour__style"
              h="4"
              color="black"
              style={{ width: '50%', margin: '0 auto 2em' }}
            >
              Lorem ipsum dolor sit amet, consectetur adipisicing elit.
              Asperiores voluptatibus aperiam minus reprehenderit fugiat?
              Officia modi quo.
            </Heading>
          </Box>
        </Row>
        <Row>
          <Box data-tut="reactour__goTo">
            <Link href="https://dribbble.com/shots/2524506-Tweet" nospaces>
              <Image
                alt="cockatoodr"
                src="https://cdn.dribbble.com/users/235991/screenshots/2524506/cockatoodr.png"
              />
            </Link>
            <Text size=".7em">
              Image by{' '}
              <Link href="https://twitter.com/hoolahk" color="dark" nospaces>
                Kate Hoolahan
              </Link>
            </Text>
          </Box>
          <Box>
            <Heading h="2" data-tut="reactour__position">
              Tweet
            </Heading>
            <Text>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit.
              Praesentium esse adipisci dolores itaque aliquid vero, officiis
              ipsam officia, corporis non magnam voluptates reprehenderit
              impedit quibusdam quo amet, ex rerum. Necessitatibus eum adipisci
              hic deserunt, ipsam eveniet, vel commodi odit id explicabo autem
              quibusdam pariatur! Voluptatem blanditiis praesentium architecto,
              temporibus quaerat?
            </Text>
          </Box>
        </Row>

        <Row>
          <Box align="right">
            <Heading h="2">{"I'm bringin silver back"}</Heading>
            <Text>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quidem
              odio asperiores ex autem impedit consequatur, iste distinctio
              illum, delectus eius minima? Laudantium labore numquam, nihil.
            </Text>
          </Box>
          <Box>
            <Link
              href="https://dribbble.com/shots/2696833-I-m-bringin-silver-back"
              nospaces
            >
              <Image
                alt="giril"
                src="https://cdn.dribbble.com/users/235991/screenshots/2696833/giril-01.png"
              />
            </Link>
            <Text size=".7em">
              Image by{' '}
              <Link href="https://twitter.com/hoolahk" color="dark" nospaces>
                Kate Hoolahan
              </Link>
            </Text>
          </Box>
        </Row>

        <Row>
          <Box>
            <Link href="https://dribbble.com/shots/3380738-Little-dog" nospaces>
              <Image
                alt="dog"
                src="https://cdn.dribbble.com/users/235991/screenshots/3380738/dog.png"
              />
            </Link>
            <Text size=".7em">
              Image by{' '}
              <Link href="https://twitter.com/hoolahk" color="dark" nospaces>
                Kate Hoolahan
              </Link>
            </Text>
          </Box>
          <Box>
            <Heading h="2">Little Dog</Heading>
            <Text>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit.
              Asperiores voluptatibus aperiam minus reprehenderit fugiat?
              Officia modi quo, rerum labore et consectetur minima consequatur
              rem, animi quis molestias optio facere pariatur cupiditate?
              Accusamus architecto maiores, beatae earum eaque, autem eius
              saepe, nesciunt aut, ducimus aliquid sequi itaque fugit veniam
              non. Suscipit hic, ad aliquid veniam quod veritatis id voluptas
              similique nemo.
            </Text>
          </Box>
        </Row>
      </Section>

      <Section
        data-tut="reactour__state--observe"
        style={{ paddingBottom: '3em' }}
      >
        <Row>
          <Box center>
            <Heading h="1">Also its beautiful Buildings</Heading>
          </Box>
        </Row>
        <Row>
          <Box data-tut="reactour__action">
            <Link
              href="https://dribbble.com/shots/2788237-Tilford-Street"
              nospaces
            >
              <Image
                alt="tilforddr"
                src="https://cdn.dribbble.com/users/235991/screenshots/2788237/tilforddr-01.png"
              />
            </Link>
            <Text size=".7em">
              Image by{' '}
              <Link href="https://twitter.com/hoolahk" color="dark" nospaces>
                Kate Hoolahan
              </Link>
            </Text>
          </Box>
          <Box>
            <Heading h="2">Tilford Street</Heading>
            <Text>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit.
              Asperiores voluptatibus aperiam minus reprehenderit fugiat?
              Officia modi quo, rerum labore et consectetur minima consequatur
              rem, animi quis molestias optio facere pariatur cupiditate?
              Accusamus architecto maiores, beatae earum eaque, autem eius
              saepe, nesciunt aut, ducimus aliquid sequi itaque fugit veniam
              non. Suscipit hic, ad aliquid veniam quod veritatis id voluptas
              similique nemo.
            </Text>
          </Box>
        </Row>

        <Row>
          <Box align="right">
            <Heading
              
```

### Core Architecture Module: `apps/web/components/Image.js`
```
import styled from '@emotion/styled'

export default styled.img`
  border: 0;
  display: block;
  max-width: 100%;
  width: 100%;
`

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #493** (2022-08-29): **Webpack fails for JS projects from trying to load index.tsx**
  *Symptoms*: **Describe the bug** Not all projects use TypeScript, and not all projects have `.ts`/`.tsx` loaders. This error occurs when using Next.js without TypeScript.  **Expected behavior** This package should not expect that TypeScript will be available out of the box.  ``` error - ./node_modules/@reactour/tour/index.tsx Module parse failed: Unexpected token (8:7) You may need an appropriate loader to handle this file type, currently no loaders are configured to process this file. See https://webpack.js.org/concepts#loaders | export default Tour | export { Tour, TourContext, TourProvider, useTour } > export type { |   StepType, |   Position, ```  
  **Post-Mortem & Fix Analysis**:
  > Hi @yanickrochon , thanks for open the _Issue_.  Just fiunding a fix for this one in the same moment you open this issue.  Let me investigate a little more and came back to you asap.
  > Is there even a way to fix this problem instantly? We can't work for hours because of this. Revert it back until the problem is fixed
  > <img width="424" alt="Ekran Resmi 2022-08-25 21 07 36" src="https://user-images.githubusercontent.com/29544960/186738028-7471790c-4a7c-476b-8126-7921a6fc2f9b.png"> Attached error appears with version 3.0.3

- **Issue #492** (2022-08-25): **Arrow demo does not work**
  *Symptoms*: the [arrow demo](https://reactour.vercel.app/) is broken using version 3.x.  <img width="758" alt="image" src="https://user-images.githubusercontent.com/2291033/186614634-74b53fce-51b6-4970-b464-c03ce123dac2.png">  I think it's caused by @reactour/mask or @reactour/popover dependency.  After lock version manually in package.json resolutions field it works well:  ``` "resolutions": {   "@reactour/mask": "0.5.1",   "@reactour/popover": "0.5.0" }, ```  <img width="1151" alt="image" src="https://user-images.githubusercontent.com/2291033/186616200-27f0e9b4-9f48-4240-ac94-265b8705cfc1.png">   But downgrade @reactour/tour to version 2.x still not work because it's dependency version is `*`  <img width="707" alt="image" src="https://user-images.githubusercontent.com/2291033/186614030-f9835976-1de0-48a2-9028-46bedd98c81a.png">     
  **Post-Mortem & Fix Analysis**:
  > Why not lock @reactour/tour dependency versions in package.json?  This leads to my previous code broken after upgrade to 3.x and still not work after downgrade to 2.x...
  > Hi @elixiao, thanks for open the _Issue_ and to catch this specific use-case!  Since `v3` @reatour/* packages doesn't use anymore a css-in-js lib (that was emotion). This results in that there is no more need to install this lib as `peerDep` and there is also a reduced bundle size. This lib was used for really tiny but handy peaces of code, like style pseudo elements using dynamic values. That is the case for the `:after` element in the arrow example. I am adding `classNames` (so ![Screenshot 2022-08-25 at 12 15 15](https://user-images.githubusercontent.com/784056/186639181-1d01a614-8dfa-4897-b312-95c2335b9296.png) on will update docs) that will be useful, to override styles on user-land, and helps as to solve those situations (like pseudo-elements and pseudo-classes) using `--css-variables`.  Here is the [updated demo](https://reactour.vercel.app/popover) which is using the last version of `@reactour/popover`.  
  > @elrumordelaluz I didn't know that variables can be used in this way. Before you told me I use another hack solution:  ```js const stepArrowDirections = ['bottom', 'right', 'left', 'top'] function ContentComponent(props) {   const { currentStep, steps, setIsOpen, setCurrentStep } = props   const isLastStep = currentStep === steps.length - 1   const content = steps[currentStep].content      return (     <div className={`user-guide-content ${stepArrowDirections[currentStep]}-arrow`}>        // code here     </div>   ) } const props = {   steps,   ContentComponent, // this is the crucial point   className: 'user-guide',   styles: {     popover: (base, state) => {       return {         ...base,         // ...doArrow(state.position, state.verticalAlign, state.horizontalAlign), // do not work here       }     },     maskArea: (base) => ({ ...base, rx: 5 }),   }, } export default function ({ children }) {   return <TourProvider {...props}>{children}</TourProvide

- **Issue #490** (2022-08-22): **Small visual bug in Safari**
  *Symptoms*: **Describe the bug**  The cross moved a little in Safari  **To Reproduce** Steps to reproduce the behavior: 1. Open Safari 2. Open tour  **Expected behavior**  The cross is fully visible  **Screenshots**  <img width="812" alt="image" src="https://user-images.githubusercontent.com/15047511/185451702-bec852d0-445c-494a-ae5d-2643011ae75e.png">  **Additional context**  Can be fixed if add `display: block` to `svg` 
  **Post-Mortem & Fix Analysis**:
  > Thank you @dartess for the point! Should be available now on `v3.0.1`
  > @elrumordelaluz Thanks for the quick reaction! Unfortunately, I'm not that fast.  Now version `v3.0.1` is not working:  ``` WARNING in ../node_modules/@reactour/tour/dist/tour.esm.js 816:36-42 export 'Portal' (imported as 'Portal') was not found in '@reactour/utils' (possible exports: Observables, bestPositionOf, getInViewThreshold, getPadding, getRect, getWindow, inView, isHoriz, isOutsideX, isOutsideY, safe, smoothScroll, useElemRect, useIntersectionObserver, useRect) ```  `v3.1.0` works, but this original problem with cross still exists:  <img width="114" alt="image" src="https://user-images.githubusercontent.com/15047511/187211317-f8115bec-a1c5-467b-87a5-142cec4ed39e.png">  p.s. in demo https://reactour.vercel.app in safari now the cross went even lower; now it is not visible at all:  <img width="1134" alt="image" src="https://user-images.githubusercontent.com/15047511/187211270-9da9f599-da37-48ac-8484-041dc308dd82.png"> 
  > Thank you for pointing this out again! Should be now solved in `v3.1.1`

- **Issue #488** (2022-08-12): **Unnecessary network requests**
  *Symptoms*: **Describe the bug** On every render there is a new network request in the Network Tab  **To Reproduce** Steps to reproduce the behavior: 1. Go to [https://reactour.vercel.app](https://reactour.vercel.app/) 2. Scroll down to "Smooth scroll" 3. Open developer tools 4. Navigate to the network tab 5. Click on "Start tour" 6. Click on the "Right arrow" of Popover  **Expected behavior** No requests are sent  **Screenshots** <img width="1787" alt="Screen Shot 2022-08-11 at 12 27 05 PM" src="https://user-images.githubusercontent.com/8925613/184095032-71859b0c-3dcd-4259-a3bd-a77bdbed01b2.png">  **Desktop (please complete the following information):**  - OS: MacOS  - Browser: Chrome  - Version 103.0.5060.134 (Official Build) (x86_64) 
  **Post-Mortem & Fix Analysis**:
  > Hi @spiderhands, thanks for open the _Issue_.  I am only getting the same result on Chrome, not in FF nor in Safari. Let's investigate which could be the source of the problem.
  > It seems that there are `img` requests.  ![Screenshot 2022-08-11 at 11 38 36](https://user-images.githubusercontent.com/784056/184106194-fd995736-eb71-4633-91ae-71c05a3bb1c4.png)   
  > Something tries to navigate to a URL with the mask hash at the end  https://emaxple.com/some-page#mask__dvybzk7rb9a

- **Issue #486** (2022-07-30): **Not working when using it for elements inside shadow root**
  *Symptoms*: First of all thanks for this great library, I have used it in several projects so far but when it comes to Microfrontend development we have found some issues:  **Describe the bug** When using shadow DOM it is just not working. I am passing an element that is inside a shadow root using the 'selector' property as an element and it is not showing the tour in the right position, it just appearing in the top left corner.  **To Reproduce** Steps to reproduce the behavior: - Usage in React 1. Create a web component with a shadow root in 'open' mode 2. Create Button element inside the shadow root 3. Try to set up the tour targeting the Button inside the shadow root  4. See error  **Expected behavior** Display the Tour Popover in the right position. It would be great to be able to provide an element where the <reactour-portal > is appended and also all the JSS styles are applied so the global scope is not polluted. Something like StyleSheetManager in styled-components.  If you know a possible workaround would be also great. For now we are disabling the Tour in some modules because of this issue.  Thanks 
  **Post-Mortem & Fix Analysis**:
  > Hi @MarcLopezAvila, thanks for open the _Issue_.  Since you closed the issue, can you share what was the solution, in order to be helpful to others?  Otherwise, if the issue persists, mind creating a minimal reproduction in a sandbox in order to allow to debug your use-case and try to find a solution? Thanks!
  > In this case I managed to always pass an Element as a selector (because with js you can querySelector the shadow root) but because the elements of the steps are not there all at once (they can be in another page or tab), I had to do a 'setSteps' execution all the time with the right step index so at the moment of the step definition the querySelector for the step element can find it.  When you pass a selector as a string it works well because you query the selector just when the step is activated but when you pass Elements, that query is not delayed until the step is activated, it must be passed when the steps are defined, so this actually is still kind of a problem because I don't want to be calling setSteps all the time just to be able to supply the Element.  It's a workaround but it works for selectors. It doesn't though for detecting mutations so I created an Issue in this repository. https://github.com/elrumordelaluz/reactour/issues/487  **Possible solution**  I think it w

- **Issue #484** (2022-07-14): **Bug with scrolling to element which is not in viewport**
  *Symptoms*: **Describe the bug** When element which needs to be highlighted is not in viewport, popover first goes to center and then to that element. If animation is fast, like it is in my example, it will look like bug.  **Expected behavior** I would like to make animation looks smooth, like it looks in the second part of video (where I unzoom window).  **Video with reproduction of bug** https://www.veed.io/view/2ddf4637-38e1-4bed-b8a4-5652752bea74?sharingWidget=true  **TourProvider code** ``` <TourProvider         steps={steps} // just steps with content and selectors         disableInteraction         styles={tourStyles} // just added borderRadius and padding to popover         padding={{ mask: 0 }}         ContentComponent={ContentComponentWrap({ type })} // custom popover with state changing functionality (currentStep +1 or -1)         afterOpen={disableBody} // disabled body scroll         beforeClose={enableBody} // enabled body scroll         inViewThreshold={isMobile ? null : threshold}         startAt={startAt}         scrollSmooth={scrollSmooth}       >         {children} </TourProvider> ``` 
  **Post-Mortem & Fix Analysis**:
  > Hi @jorgadev, thanks for open the _Issue_.  Let me investigate a little and get back to you asap.  Did you tried using `scrollSmooth={false}` or removing it at all?
  > > Hi @jorgadev, thanks for open the _Issue_. >  > Let me investigate a little and get back to you asap. >  > Did you tried using `scrollSmooth={false}` or removing it at all?  Posted example is with `scrollSmooth={false}`. Without `scrollSmooth` behaviour is similar as one with `scrollSmooth={false}`. If I put it on `true` it jumps in middle like this: https://www.veed.io/view/ff6920f9-59f3-4949-8b09-4be95a4a0931?sharingWidget=true
  > Without `scrollSmooth` or setting it as `false`, the _Tour_ not only should not go to the center when _transitioning_ but also skip at all the _scroll behavior_. If the last part doesn't happening probably is set the [css scroll-behavior](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior). Since the _Tour_ is using the native way to _smooth scroll_ is sensible to this also. For example, in [this sandbox](https://codesandbox.io/s/tour-demo-using-react-router-dom-with-automatic-route-switching-forked-jezipv?file=/src/styles.css), until I override the css, the `scrollBehavior` prop on _TourProvider_ doesn't change the behavior; this is because this demo is using `bootstrap` lib, which [sets this](https://github.com/twbs/bootstrap/blob/main/dist/css/bootstrap.css#L84-L88) when `prefers-reduced-motion: no-preference)`.  Please try overriding the scroll behavior, something like: ```css html {   scroll-behavior: auto !important; } ``` and let me know if this is what you

- **Issue #471** (2022-05-02): **Tour not scrolling to view the next component**
  *Symptoms*: **Describe the bug** The tour initialization is correct and it works as expected for 1st 3 steps as all the components are in the viewport. But the 4th step is regarding the component which is not visible and here the problem arises that the tour does not scroll the page to bring that component into view. I followed the exact steps mentioned in the docs and also the code is similar to the demo.  **To Reproduce** Steps to reproduce the behavior: 1. Go to https://stackblitz.com/edit/nextjs-m696rr?file=pages/_app.js 2. Scroll down to view the issue 3. See that component does not come into view  **Expected behavior** When the component is not in view the tour should scroll the page to bring that component into view.  **Desktop (please complete the following information):**  System:     OS: Windows 10 10.0.19044     Browser: Chrome and Brave     CPU: (8) x64 Intel(R) Core(TM) i5-10210U CPU @ 1.60GHz     Memory: 2.24 GB / 15.83 GB   Binaries:     Node: 16.14.2 - C:\Program Files\nodejs\node.EXE     Yarn: 1.22.5 - C:\Program Files (x86)\Yarn\bin\yarn.CMD     npm: 8.5.0 - C:\Program Files\nodejs\npm.CMD  **Additional context** I'm using nextjs and material UI. I'm not able to figure out the issue for 2 days. I went through all the previous issues but yet couldn't figure out anything specifically useful. Urgent help is needed. Thanks 👍
  **Post-Mortem & Fix Analysis**:
  > Hi @s-pcode, thanks for open the _Issue_.  Is it possible to you to upgrade to `@reactour/tour@2.x.x` version?  The scrolling when switching routes seems to work as expected, like in [this demo](https://codesandbox.io/s/tour-demo-using-react-router-dom-with-automatic-route-switching-forked-z8jyvg)
  > Ok, I'll have a look at v2.  Thanks 👍 
  > >   Is it possible to make that popover doesn't go do center first (like it goes in demo), and then to highlighted element, but immediately to highlighted element?

- **Issue #470** (2022-06-18): **Can not use `steps[currentStep].content` when `content` is `JSX`**
  *Symptoms*: **Describe the bug** I've added some `JSX` inside the `content` of a step. Now I want to render it inside the `ContentComponent` using `steps[currentStep].content`. I've tried everything but it doesn't show up. But as long as I comment out the `ContentComponent`, it does show up. I need to show it inside the `ContentComponent`.  **To Reproduce** 1. Go to this sandbox link: https://codesandbox.io/s/keen-kowalevski-zopbhd 2. Click on the `Start Tour` button to start the tour. It will show the `JSX` that is added inside the `content` of the step. 3. Scroll down to 'ContentComponent' and uncomment it. 4. It will no longer show the `JSX` inside the `content` of the step.  **Expected behavior** `JSX` to show up inside the `ContentComponent` by `steps[currentStep].content`.  **Screenshots** https://user-images.githubusercontent.com/33332648/165378482-51cf70b7-a8ba-46ae-a682-cab19b000910.mov  **Desktop (please complete the following information):**  - OS: MacOS  - Browser: Chrome  - Version: 12.3.1  **Additional context:** 1. I think I'm using `ContentComponent` the wrong way, please guide
  **Post-Mortem & Fix Analysis**:
  > Hi @hali241997, thanks for open the _Issue_.  The reason is that when using `ContentComponent` you are responsible to check if the `step.content` prop is a `function` or not.   You can do something like this:  ```js  function ContentComponent(props) {   const content = props.steps[props.currentStep].content;   return typeof content === "function"     ? content({ ...props, someOtherStuff: "Custom text" })     : content; } ```  [Here](https://codesandbox.io/s/pensive-moon-geyxus?file=/src/App.js) is a working example.  Will update the example in Readme to be clearer. Thanks to pointing this out!
  > @elrumordelaluz This might work in `js` but it gives typing errors in `ts`. A better approach: ``` ContentComponent={({                 steps,                 currentStep,                 setCurrentStep,                 setIsOpen,               }) => {                 const content = steps[currentStep].content;                  if (typeof content === "function") {                   return (                     <>                       {content({                         currentStep,                         setCurrentStep,                         setIsOpen,                         transition: false,                       })}                     </>                   );                 }                 return null;               }} ```  Since `ContentComponent` expect `JSX`, so we wrap the `content` with `<></>`. The `content` only needs the following: - `currentStep` - `setCurrentStep` - `setIsOpen` - `transition`  I have set `transition` to `false` becau
  > Thank you @hali241997, mind giving an eye into the codebase in order to improve typing directly?   Thanks again!

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `f38832ff` (2026-05-19)
**Commit Message**: fix(tour): scope disableActions to its declaring step

When a step set `disableActions: true`, the flag carried over into every
subsequent step until one explicitly set it back to `false`. The effect
guarded the state update with `if (step?.disableActions !== undefined)`,
so omitting the field on the next step left the previous value in place
and silently disabled navigation/mask/keyboard interactions.

Drop the guard and treat a missing `disableActions` as `false`, so the
flag is re-evaluated on every step transition and only affects the step
that declares it. Added a regression test that advances past a step with
`disableActions: true` and asserts the mask click handler fires again.

Closes #683

**File**: `packages/tour/Tour.tsx` (modified, +1/-3)
```diff
@@ -113,9 +113,7 @@ const Tour: React.FC<TourProps> = ({
       step?.action(target)
     }
 
-    if (step?.disableActions !== undefined) {
-      setDisabledActions(step?.disableActions)
-    }
+    setDisabledActions(step?.disableActions ?? false)
 
     return () => {
       if (step?.actionAfter && typeof step?.actionAfter === 'function') {
```

**File**: `packages/tour/__tests__/Tour.test.tsx` (modified, +39/-1)
```diff
@@ -1,6 +1,6 @@
 import React from 'react'
 import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest'
-import { fireEvent, render } from '@testing-library/react'
+import { act, fireEvent, render } from '@testing-library/react'
 import { TourProvider } from '../Context'
 
 beforeAll(() => {
@@ -207,6 +207,44 @@ describe('Tour orchestrator', () => {
     ).not.toBeNull()
   })
 
+  it('resets disableActions when the next step omits it (issue #683)', () => {
+    const b = document.createElement('div')
+    b.id = 'b'
+    document.body.appendChild(b)
+    const customSteps = [
+      { selector: '#a', content: 'A', disableActions: true },
+      { selector: '#b', content: 'B' },
+    ]
+    const onClickMask = vi.fn()
+    let externalSetStep: ((n: number) => void) | undefined
+    const Harness: React.FC = () => {
+      const [step, setStep] = React.useState(0)
+      externalSetStep = setStep
+      return (
+        <TourProvider
+          steps={customSteps}
+          defaultOpen
+          currentStep={step}
+          setCurrentStep={setStep as any}
+          onClickMask={onClickMask}
+        >
+          <div />
+        </TourProvider>
+      )
+    }
+    render(<Harness />)
+    // Step 0 disables actions: mask click is a no-op (handler not invoked).
+    fireEvent.click(document.querySelector('.reactour__mask')!)
+    expect(onClickMask).not.toHaveBeenCalled()
+
+    // Advance to step 1 (no disableActions): the handler should fire now.
+    act(() => {
+      externalSetStep!(1)
+    })
+    fireEvent.click(document.querySelector('.reactour__mask')!)
+    expect(onClickMask).toHaveBeenCalledTimes(1)
+  })
+
   it('uses step.position when no global position is provided', () => {
     const customSteps = [
       { selector: '#a', content: 'A', position: 'top' as const },
```

---

### Incident Patch 2: `34ec5321` (2025-08-27)
**Commit Message**: Merge branch 'A-Veereshwar-bugFix_by_veereshwar'

**File**: `apps/docs/app/mask/props/page.mdx` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ Type: `number | number[]`
 
 Extra space to add between viewport with and height.
 
-<ToggleBox title="Sapce calculation">
+<ToggleBox title="Space calculation">
   Calculation is based on [padding shorthand
   syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/padding#syntax)
   <OptionTable
```

**File**: `apps/docs/app/popover/props/page.mdx` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ Type: `number | number[]`
 
 Extra space to add in _Popover_ calculations. Useful when calculating space from _Element_ bounding rect and want to add more space.
 
-<ToggleBox title="Sapce calculation">
+<ToggleBox title="Space calculation">
   Calculation is based on [padding shorthand
   syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/padding#syntax)
   <OptionTable
```

---

### Incident Patch 3: `7106182a` (2025-08-26)
**Commit Message**: [ bugFix] - docs: fix typo 'Sapce' -> 'Space' in mask props section

**File**: `apps/docs/app/mask/props/page.mdx` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ Type: `number | number[]`
 
 Extra space to add between viewport with and height.
 
-<ToggleBox title="Sapce calculation">
+<ToggleBox title="Space calculation">
   Calculation is based on [padding shorthand
   syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/padding#syntax)
   <OptionTable
```

**File**: `apps/docs/app/popover/props/page.mdx` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ Type: `number | number[]`
 
 Extra space to add in _Popover_ calculations. Useful when calculating space from _Element_ bounding rect and want to add more space.
 
-<ToggleBox title="Sapce calculation">
+<ToggleBox title="Space calculation">
   Calculation is based on [padding shorthand
   syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/padding#syntax)
   <OptionTable
```

---

### Incident Patch 4: `67bc62c3` (2025-07-28)
**Commit Message**: Fix ads styles

**File**: `apps/docs/app/globals.css` (modified, +25/-1)
```diff
@@ -4,4 +4,28 @@
 @import 'nextra-theme-docs/style.css';
 /* or nextra-theme-blog/style.css */
 
-@variant dark (&:where(.dark *));
\ No newline at end of file
+@variant dark (&:where(.dark *));
+
+#carbon-responsive {
+    position: fixed;
+    max-inline-size: 70px !important;
+    bottom: 0;
+    left: 2px;
+    font-size: 10px !important;
+}
+
+@media (width >=40rem) {
+    #carbon-responsive {
+        bottom: 70px;
+        left: 10px;
+        max-inline-size: 240px !important;
+        font-size: 14px !important;
+    }
+}
+
+@media (width >=80rem) {
+    #carbon-responsive {
+        right: 10px;
+        left: auto;
+    }
+}
\ No newline at end of file
```

**File**: `apps/docs/app/layout.js` (modified, +11/-5)
```diff
@@ -97,10 +97,6 @@ const footer = (
 export default async function RootLayout({ children }) {
   return (
     <html lang="en" dir="ltr" suppressHydrationWarning>
-      <Script
-        src="//cdn.carbonads.com/carbon.js?serve=CWYI623E&placement=wwwreacttours&format=responsive"
-        id="_carbonads_js"
-      />
       <Script src="https://www.googletagmanager.com/gtag/js?id=G-ZQ9SP2F9PW" />
       <Script id="google-analytics">
         {`
@@ -118,7 +114,17 @@ export default async function RootLayout({ children }) {
           pageMap={await getPageMap()}
           docsRepositoryBase="https://github.com/elrumordelaluz/reactour/tree/main/apps/docs"
           footer={footer}
-          toc={{ backToTop: true }}
+          toc={{
+            backToTop: true,
+            extraContent: (
+              <>
+                <Script
+                  src="//cdn.carbonads.com/carbon.js?serve=CWYI623E&placement=wwwreacttours&format=responsive"
+                  id="_carbonads_js"
+                />
+              </>
+            ),
+          }}
           sidebar={{ toggleButton: true, defaultMenuCollapseLevel: 1 }}
           feedback={{
             content: 'Question? Give us feedback →',
```

---

### Incident Patch 5: `bc52b569` (2025-05-26)
**Commit Message**: Fix search

closes #671

**File**: `apps/docs/package.json` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     "dev": "next --turbopack",
     "build": "next build && pnpm postbuild",
     "start": "next start",
-    "postbuild": "pagefind --site .next/server/app --output-path out/_pagefind"
+    "postbuild": "pagefind --site .next/server/app --output-path public/_pagefind"
   },
   "devDependencies": {
     "pagefind": "^1.3.0"
```

---

### Incident Patch 6: `a2fe08bd` (2025-05-15)
**Commit Message**: Fix words.

Closes #667 #668

**File**: `apps/docs/app/popover/quickstart/page.mdx` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Install and use the Mask
+# Install and use the Popover
 
 A popover positioned based on certain values
 
```

**File**: `apps/docs/app/tour/quickstart/page.mdx` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-# Install and use the Mask
+# Install and use the Tour
 
 Tourist Guide into your React Components
 
```

---

### Incident Patch 7: `4d822cb8` (2024-12-19)
**Commit Message**: fix(docs): carbon ads overlapping entire screen on desktop

**File**: `apps/docs/style.css` (modified, +2/-1)
```diff
@@ -29,9 +29,10 @@ code.text-\[\.9em\] {
 @media (min-width: 768px) {
   #carbonads {
     top: 80px;
+    height: fit-content;
   }
 
   nav.nextra-toc .nextra-scrollbar {
     top: 200px;
   }
-}
\ No newline at end of file
+}
```

---

### Incident Patch 8: `6e1907d4` (2024-09-21)
**Commit Message**: [Issue-643] Fix the text in Step 12 demo

**File**: `apps/web/components/config.tsx` (modified, +2/-2)
```diff
@@ -127,15 +127,15 @@ const tourConfig: StepType[] = [
   {
     selector: '[data-tut="reactour__highlighted"]',
     content:
-      'Moreover you can highlight multiple elements and adjust highlighted region depending on DOM resizes and mutations. Try clicking the "?" tooltip and playing with tabs...',
+      'Moreover you can highlight multiple elements and adjust highlighted region depending on DOM resizes and mutations. Try clicking the "Open Modal" button and playing with tabs...',
     highlightedSelectors: ['[data-tut="reactour__highlighted-absolute-child"]'],
     mutationObservables: ['[data-tut="reactour__highlighted-absolute-child"]'],
     resizeObservables: ['[data-tut="reactour__highlighted-absolute-child"]'],
   },
   {
     selector: '[data-tour="open_modal"]',
     content:
-      'Moreover you can highlight multiple elements and adjust highlighted region depending on DOM resizes and mutations. Try clicking the "?" tooltip and playing with tabs...',
+      'Moreover you can highlight multiple elements and adjust highlighted region depending on DOM resizes and mutations. Try clicking the "Open Modal" button and playing with tabs...',
     highlightedSelectors: ['.modaaals-modal'],
     mutationObservables: ['#portaaal'],
   },
```

---

### Incident Patch 9: `bcd512c9` (2024-07-22)
**Commit Message**: Fix recurring typo (change "Exmple" to "Example")

**File**: `apps/docs/pages/tour/props.mdx` (modified, +4/-4)
```diff
@@ -111,7 +111,7 @@ Available Components and its `props`
 />
 </ToggleBox>
 
-<ToggleBox title="Exmple">
+<ToggleBox title="Example">
 
 ```js
 import { components } from '@reactour/tour'
@@ -384,7 +384,7 @@ Click handler for highlighted area. Only works when `disableInteraction` is acti
 
 Useful in case is needed to avoid `onClickMask` when clicking the highlighted element.
 
- <ToggleBox title="Exmple">
+ <ToggleBox title="Example">
 
 ```js
 <TourProvider
@@ -431,7 +431,7 @@ Function to handle keyboard events in a custom way.
   Type: `(e: KeyboardEvent, clickProps?: ClickProps, status?: { isEscDisabled?: boolean, isRightDisabled?: boolean, isLeftDisabled?: boolean }) => void`
 </ToggleBox>
 
-<ToggleBox title="Exmple">
+<ToggleBox title="Example">
 
 ```js
 <TourProvider
@@ -594,7 +594,7 @@ Completelly custom component to render inside the [Popover](/popover/quickstart)
   />
 </ToggleBox>
 
-<ToggleBox title="Exmple">
+<ToggleBox title="Example">
 
 ```js
 function ContentComponent(props) {
```

---

### Incident Patch 10: `78a6c8f3` (2024-06-20)
**Commit Message**: Fix issue with padding calculations

**File**: `apps/docs/package.json` (modified, +6/-6)
```diff
@@ -10,13 +10,13 @@
     "start": "next start"
   },
   "dependencies": {
-    "@codesandbox/sandpack-react": "^2.13.10",
+    "@codesandbox/sandpack-react": "^2.14.4",
     "@codesandbox/sandpack-themes": "^2.0.21",
     "@vercel/og": "^0.6.2",
     "body-scroll-lock": "^4.0.0-beta.0",
     "clsx": "^2.1.1",
-    "framer-motion": "^11.2.6",
-    "next": "^14.2.3",
+    "framer-motion": "^11.2.11",
+    "next": "^14.2.4",
     "nextra": "2.13.4",
     "nextra-theme-docs": "2.13.4",
     "react": "^18.3.1",
@@ -26,11 +26,11 @@
   "devDependencies": {
     "@svgr/webpack": "^8.0.1",
     "@types/body-scroll-lock": "^3.1.2",
-    "@types/node": "^20.12.12",
+    "@types/node": "^20.14.6",
     "@types/react": "^18.3.3",
     "autoprefixer": "^10.4.19",
-    "eslint": "^9.3.0",
+    "eslint": "^9.5.0",
     "postcss": "^8.4.38",
-    "tailwindcss": "^3.4.3"
+    "tailwindcss": "^3.4.4"
   }
 }
```

**File**: `apps/web/components/config.tsx` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ const tourConfig: StepType[] = [
     selector: '[data-tut="reactour__iso"]',
     content:
       "Ok, let's start with the name of the Tour that is about to begin.",
+    position: 'right',
   },
   {
     selector: '[data-tut="reactour__logo"]',
```

**File**: `apps/web/package.json` (modified, +5/-5)
```diff
@@ -10,7 +10,7 @@
     "export": "rm -rf ../../docs && next build && next export  -o ../../docs"
   },
   "dependencies": {
-    "@codesandbox/sandpack-react": "^2.13.10",
+    "@codesandbox/sandpack-react": "^2.14.4",
     "@codesandbox/sandpack-themes": "^2.0.21",
     "@emotion/react": "^11.11.4",
     "@emotion/styled": "^11.11.5",
@@ -19,20 +19,20 @@
     "@reactour/tour": "*",
     "@reactour/utils": "*",
     "body-scroll-lock": "^4.0.0-beta.0",
-    "framer-motion": "^11.2.6",
+    "framer-motion": "^11.2.11",
     "modaaals": "^1.1.2",
-    "next": "14.2.3",
+    "next": "14.2.4",
     "react": "18.3.1",
     "react-device-detect": "^2.2.3",
     "react-dom": "18.3.1"
   },
   "devDependencies": {
     "@reactour/tsconfig": "*",
     "@types/body-scroll-lock": "^3.1.2",
-    "@types/node": "^20.12.12",
+    "@types/node": "^20.14.6",
     "@types/react": "18.3.3",
     "config": "3.3.11",
-    "eslint": "9.3.0",
+    "eslint": "9.5.0",
     "eslint-plugin-prettier": "^5.1.3",
     "next-transpile-modules": "10.0.1",
     "typescript": "^5.4.5"
```

**File**: `package.json` (modified, +2/-2)
```diff
@@ -18,8 +18,8 @@
   },
   "devDependencies": {
     "eslint-plugin-prettier": "^5.1.3",
-    "prettier": "^3.2.5",
-    "turbo": "^1.13.3"
+    "prettier": "^3.3.2",
+    "turbo": "^2.0.4"
   },
   "engines": {
     "npm": ">=7.0.0",
```

**File**: `packages/config/package.json` (modified, +2/-2)
```diff
@@ -7,8 +7,8 @@
     "eslint-preset.js"
   ],
   "dependencies": {
-    "eslint-config-next": "^14.2.3",
+    "eslint-config-next": "^14.2.4",
     "eslint-config-prettier": "^9.1.0",
-    "eslint-plugin-react": "7.34.1"
+    "eslint-plugin-react": "7.34.3"
   }
 }
```

#### Recent Merged Pull Requests:
- **PR #687** (2026-05-15): test/tour suite expansion (@elrumordelaluz)
- **PR #686** (2026-05-15): chore: migrate workspace from yarn 1 to pnpm (@elrumordelaluz)
- **PR #685** (2026-05-15): test: add vitest + rtl scaffold with PR ci workflow (@elrumordelaluz)
- **PR #681** (2025-08-27): [ bugFix] - docs: fix typo 'Sapce' -> 'Space' in mask props section (@A-Veereshwar)
- **PR #680** (2025-08-14): Add missed ClickProps type export (@Andrii256)
- **PR #668** (closed): Update quickstart.mdx (@0xA-10)
- **PR #667** (closed): Update quickstart.mdx (@0xA-10)
- **PR #660** (2024-12-20): fix(docs): carbon ads overlapping entire screen on small desktop (@D3kion)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
