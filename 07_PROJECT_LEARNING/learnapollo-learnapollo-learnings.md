# Forensic Learning Record (Deep Inspection): learnapollo/learnapollo

> **Canonical Artifact**: `07_PROJECT_LEARNING/learnapollo-learnapollo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/learnapollo/learnapollo](https://github.com/learnapollo/learnapollo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:05:29.444Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `learnapollo/learnapollo`
- **Description**: 👩🏻‍🏫   Learn Apollo - A hands-on tutorial for Apollo GraphQL Client (created by Graphcool)
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5145 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils/content.ts`
```
import { Parser, Node } from 'commonmark'

export class Chapter {
  title: string
  alias: string
  isTrack: boolean
  description: string
  subchapters: Subchapter[]

  constructor(title: string,
              alias: string,
              isTrack: boolean,
              description: string,
              subchaptersData: SubchapterData[]) {
    this.title = title
    this.alias = alias
    this.isTrack = isTrack
    this.description = description
    this.subchapters = subchaptersData.map((d) => new Subchapter(d.title, d.alias, this))
  }
}

interface SubchapterData {
  title: string
  alias: string
}

interface SubchapterDataWithMeta extends SubchapterData {
  isLast: boolean
}

const parser = new Parser()

class Subchapter {
  title: string
  alias: string
  chapter: Chapter

  constructor(title: string, alias: string, chapter: Chapter) {
    this.title = title
    this.alias = alias
    this.chapter = chapter
  }

  ast(): Node {
    return parser.parse(require(`../../content/${this.chapter.alias}/${this.alias}.md`))
  }
}

export const chapters: Chapter[] = [
  new Chapter('Overview', 'introduction', false, 'Receive your own GraphQL server and setup your environment to get started with Learn Apollo in the introduction.', [{
    title: 'Introduction',
    alias: 'get-started',
  }]),
  new Chapter('React', 'tutorial-react', true, 'Learn how to easily get started with React and GraphQL with Apollo Client. You will follow a step-by-step tutorial to build a fully-fledged React Pokedex App.', [{
    title: 'Getting Started',
    alias: 'react-01',
  }, {
    title: 'Basic Queries',
    alias: 'react-02',
  }, {
    title: 'Advanced Queries',
    alias: 'react-03',
  }, {
    title: 'Fragments',
    alias: 'react-04',
  }, {
    title: 'Basic Mutations',
    alias: 'react-05',
  }, {
    title: 'Multiple Mutations',
    alias: 'react-06',
  }, {
    title: 'Pagination',
    alias: 'react-07',
  }]),
  new Chapter('React Native', 'tutorial-react-native', true, 'Learn how to easily get started with React Native and GraphQL with Apollo Client. You will follow a step-by-step tutorial to build a fully-fledged React Native Pokedex App', [{
    title: 'Getting Started',
    alias: 'react-native-01',
  }, {
    title: 'Basic Queries',
    alias: 'react-native-02',
  }, {
    title: 'Advanced Queries',
    alias: 'react-native-03',
  }, {
    title: 'Fragments',
    alias: 'react-native-04',
  }, {
    title: 'Basic Mutations',
    alias: 'react-native-05',
  }, {
    title: 'Multiple Mutations',
    alias: 'react-native-06',
  }]),
  new Chapter('iOS', 'tutorial-ios', true, 'Learn how to easily get started with iOS, GraphQL and the Apollo iOS Client. You will follow a step-by-step tutorial to build a fully-fledged iOS Pokedex App.', [{
    title: 'Getting Started',
    alias: 'ios-01',
  }, {
    title: 'Basic Queries',
    alias: 'ios-02',
  }, {
    title: 'Advanced Queries',
    alias: 'ios-03',
  }, {
    title: 'Fragments',
    alias: 'ios-04',
  }, {
    title: 'Basic Mutations',
    alias: 'ios-05',
  }, {
    title: 'Multiple Mutations',
    alias: 'ios-06',
  }]),
  new Chapter('Angular 2', 'tutorial-angular', true, 'Learn how to easily get started Angular 2 and GraphQL with Apollo Client. You will use the prepared application as a playground to experiment with an Angular 2 Pokedex App.', [{
    title: 'Playground',
    alias: 'angular-playground',
  }]),
  new Chapter('Vue.js', 'tutorial-vue', true, 'Learn how to easily get started Vue.js and GraphQL with Apollo Client. You will use the prepared application as a playground to experiment with an Vue.js Pokedex App', [{
    title: 'Playground',
    alias: 'vue-playground',
  }]),
  new Chapter('Excursions', 'excursions', false, 'Zoom in on selected concepts to build a better understanding of Apollo Client and GraphQL in these excursions.', [{
    title: 'Using the DevTools',
    alias: 'excursion-01',
  }, {
    title: 'Managing Apollo store',
    alias: 'excursion-02',
  }]),
  new Chapter('Go Further', 'go-further', false, 'Learn about how you can apply the knowledge you gained about Apollo Client and GraphQL throughout this tutorial in one of your next frontend projects.', [{
    title: 'Wrap Up',
    alias: 'wrap-up',
  }]),
]

export const subchapters: Subchapter[] = chapters.map((c) => c.subchapters).reduce((acc, s) => acc.concat(s), [])

// adds `isLast` property and returns all subchapters
const subchaptersWithMeta = chapters
  .map(chapter => chapter.subchapters
    .map((subchapter, index) => (
        Object.assign(
          {},
          subchapter,
          {isLast: chapter.subchapters.length - 1 === index},
        ) as SubchapterDataWithMeta
      ),
    ),
  )
  .reduce((acc, s) => acc.concat(s), [])

export function neighboorSubchapter(currentSubchapterAlias: string, forward: boolean): Subchapter | null {
  const index = subchapters.findIndex((s) => s.alias === currentSubchapterAlias)
  const currentIndex = index === -1 ? 0 : index
  if (forward && currentIndex + 1 <= subchapters.length) {
    return subchaptersWithMeta[currentIndex].isLast && currentIndex !== 0 && currentIndex < subchapters.length - 1
      ? subchapters[subchapters.length - 1] : subchapters[currentIndex + 1]
  } else if (!forward && currentIndex >= 1) {
    return subchapters[currentIndex - 1]
  }

  return null
}

export function getLastSubchapterAlias(subchapterAliases: string[]): string {
  let lastFinding = subchapterAliases[0]
  for (let i = 0; i < subchapters.length; i++) {
    if (subchapterAliases.includes(subchapters[i].alias)) {
      lastFinding = subchapters[i].alias
    }
  }
  return lastFinding
}

export function getTitleFromChapter(chapterAlias: string): string {
  return chapters.find(c => c.alias === chapterAlias)!.title
}

export function getTitleFromSubchapter(subchapterAlias: string): string {
  return subchapters.find(c => c.alias === subchapterAlias)!.title
}

```

### Core Architecture Module: `src/utils/dom.ts`
```
export function hashLinkScroll(retryCount: number = 0, retryLimit: number = 300) {
  const {hash} = window.location
  if (hash !== '') {
    window.requestAnimationFrame(() => {
      const id = hash.replace('#', '')
      const element = document.getElementById(id)
      if (element) {
        window.scrollTo(0, element.offsetTop)
      } else if (retryCount < retryLimit) {
        setTimeout(hashLinkScroll(retryCount + 1), 100)
      }
    })
  }
}

```

### Core Architecture Module: `src/utils/events.ts`
```
export const events = {
  JoinSlack: {
    category: 'user',
    action: 'joined-slack',
  },
  SharePanelTwitter: {
    category: 'user',
    action: 'share/twitter/share-panel',
  },
  SharePanelFacebook: {
    category: 'user',
    action: 'share/facebook/share-panel',
  },
  ShareWrapupTwitter: {
    category: 'user',
    action: 'share/twitter/wrapup',
  },
  ShareWrapupFacebook: {
    category: 'user',
    action: 'share/facebook/wrapup',
  },
  OpenGithub: {
    category: 'user',
    action: 'open-github',
  },
  EndpointReceived: {
    category: 'user',
    action: 'endpoint-received',
  },
  DownloadExample: {
    category: 'user',
    action: 'download-example',
  },
  ContentSkippedEndpoint: {
    category: 'user',
    action: 'skipped-endpoint',
  },
  SmoochOpened: {
    category: 'user',
    action: 'smooch/opened',
  },
  SmoochMessageSent: {
    category: 'user',
    action: 'smooch/message-sent',
  },
  ContentCopiedEndpoint: {
    category: 'ui',
    action: 'copied-endpoint/from-content',
  },
  OverlayCopiedEndpoint: {
    category: 'ui',
    action: 'copied-endpoint/from-overlay',
  },
  OverlayShowDatabrowser: {
    category: 'ui',
    action: 'overlay/databrowser/show',
  },
  OverlayShowGraphiQL: {
    category: 'ui',
    action: 'overlay/graphiql/show',
  },
  OverlayGraphiQLRanQuery: {
    category: 'ui',
    action: 'overlay/graphiql/run-query',
  },
  OverlayOpen: {
    category: 'ui',
    action: 'overlay/open',
  },
  OverlayClose: {
    category: 'ui',
    action: 'overlay/close',
  },
  OverlayDeletePokemon: {
    category: 'ui',
    action: 'overlay/databrowser/delete-pokemon',
  },
  OverlayUpdatePokemon: {
    category: 'ui',
    action: 'overlay/databrowser/update-pokemon',
  },
  OverlayCreatePokemon: {
    category: 'ui',
    action: 'overlay/databrowser/create-pokemon',
  },
}

```

### Core Architecture Module: `src/utils/location.tsx`
```
export function getParameterByName(name: string): string | null {
  name = name.replace(/[\[\]]/g, '\\$&')
  const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)')
  const results = regex.exec(window.location.href)
  if (!results) {
    return null
  }
  if (!results[2]) {
    return ''
  }
  return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

```

### Core Architecture Module: `src/utils/markdown.ts`
```
import {Node} from 'commonmark'

export interface HeadingNode {
  title: string | null
  children: HeadingNode[]
}

export interface Heading {
  level: number
  title: string
}

function inject(root: HeadingNode, title: string, level: number): HeadingNode {
  if (level === 1) {
    root.title = title
  } else {
    if (level === 2 || root.children.length === 0) {
      root.children.push({
        title: null,
        children: [],
      })
    }
    const lastChild = root.children[root.children.length - 1]
    inject(lastChild, title, level - 1)
  }

  return root
}

export function collectHeadings(ast: Node): Heading[] {
  const walker = ast.walker()
  let e = walker.next() as any
  let headings: Heading[] = []
  while (e !== null) {
    if (e.entering && e.node._type === 'heading') {
      let title = ''
      let next = e.node._firstChild
      while (next !== null) {
        title += next._literal
        next = next.next
      }
      headings.push({
        title,
        level: e.node._level,
      })
    }

    e = walker.next() as any
  }

  return headings
}

export function buildHeadingsTree(headings: Heading[]): HeadingNode[] {
  return headings
    .reduce(
      (root: HeadingNode, heading: Heading) => inject(root, heading.title, heading.level),
      {title: null, children: []},
    )
    .children
}

```

### Core Architecture Module: `src/utils/smooch.ts`
```
import {getStoredState} from './statestore'

export function initSmooch(): Promise<void> {
  if (!window.Smooch || navigator.userAgent === 'SSR') {
    return Promise.resolve()
  }

  const userData = getStoredState().user

  return Smooch.init({
    appToken: '4ly1eiob2s078qq6w6wsk9a1r',
    email: userData ? userData.email : undefined,
    givenName: userData ? userData.name : undefined,
  }) as Promise<void>
}

```

### Core Architecture Module: `src/utils/string.ts`
```
const _slug = require('slugify')

export function slug(str: string): string {
  return _slug(str, {lower: true})
}

```

### Core Architecture Module: `custom.d.ts`
```
declare module 'react-prism'
declare module 'react-router'
declare module 'react-router-relay'
declare module 'react-router-scroll'
declare module 'commonmark-react-renderer'
declare module 'graphiql'
declare module 'react-copy-to-clipboard'
declare module 'cuid'

declare var Smooch: any
declare var __LAST_UPDATE__: string
declare var __LAMBDA_AUTH__: string
declare var __LAMBDA_DOWNLOAD_EXAMPLE__: string
declare var __GITHUB_OAUTH_CLIENT_ID__: string
declare var __GA_TRACKING_CODE__: string

interface Window {
  Smooch: any
}

declare module 'react-relay' {

  // fragments are a hash of functions
  interface Fragments {
    [query: string]: ((variables?: RelayVariables) => string)
  }

  interface CreateContainerOpts {
    initialVariables?: Object
    fragments: Fragments
    prepareVariables?(prevVariables: RelayVariables): RelayVariables
  }

  interface RelayVariables {
    [name: string]: any
  }

  // add static getFragment method to the component constructor
  interface RelayContainerClass<T> extends React.ComponentClass<T> {
    getFragment: ((q: string, vars?: RelayVariables) => string)
  }

  interface RelayQueryRequestResolve {
    response: any
  }

  interface RelayMutationRequest {
    getQueryString(): string
    getVariables(): RelayVariables
    resolve(result: RelayQueryRequestResolve)
    reject(errors: any)
  }

  interface RelayQueryRequest {
    resolve(result: RelayQueryRequestResolve)
    reject(errors: any)

    getQueryString(): string
    getVariables(): RelayVariables
    getID(): string
    getDebugName(): string
  }

  interface RelayNetworkLayer {
    supports(...options: string[]): boolean
  }

  class DefaultNetworkLayer implements RelayNetworkLayer {
    constructor(host: string, options?: any)
    supports(...options: string[]): boolean
  }
  interface RelayQuery {
    query: string
  }
  function createContainer<T>(component: React.ComponentClass<T>, params?: CreateContainerOpts): RelayContainerClass<any>
  function injectNetworkLayer(networkLayer: RelayNetworkLayer)
  function isContainer(component: React.ComponentClass<any>): boolean
  function QL(...args: any[]): string
  function createQuery(query: string, variables: RelayVariables)

  class Route {
    constructor(params?: RelayVariables)
  }

  // Relay Mutation class, where T are the props it takes and S is the returned payload from Relay.Store.update.
  // S is typically dynamic as it depends on the data the app is currently using, but it's possible to always
  // return some data in the payload using REQUIRED_CHILDREN which is where specifying S is the most useful.
  class Mutation<T,S> {
    props: T

    constructor(props: T)
    static getFragment(q: string): string
  }

  interface Transaction {
    getError(): Error
    Status(): number
  }

  interface StoreUpdateCallbacks<T> {
    onFailure?(transaction: Transaction)
    onSuccess?(response: T)
  }

  interface Store {
    commitUpdate(mutation: Mutation<any,any>, callbacks?: StoreUpdateCallbacks<any>)
    primeCache(query: RelayQuery, callback: (done: any, error: any)=>void)
    readQuery(query: string)
  }

  var Store: Store
  var Renderer: any

  class RootContainer extends React.Component<RootContainerProps,any> {}

  interface RootContainerProps extends React.Props<RootContainer>{
    Component: RelayContainerClass<any>
    route: Route
    renderLoading?(): JSX.Element
    renderFetched?(data: any): JSX.Element
    renderFailure?(error: Error, retry: Function): JSX.Element
  }

  interface RelayProp {
    variables: any
    setVariables(variables: Object)
  }
}


```

### Core Architecture Module: `prep.ts`
```
import './src/polyfill'
import { chapters } from './src/utils/content'

export default () => {
  const chapterRoutes = chapters
    .reduce((acc, c) => acc.concat(c.subchapters.map((s) => `/${c.alias}/${s.alias}`)), [])

  return {
    routes: chapterRoutes.concat(['/']),
    https: true,
    concurrency: 50,
    timeout: 10000,
    hostname: 'https://www.learnapollo.com',
    useragent: 'SSR',
  }
}

```

### Core Architecture Module: `src/components/App/App.tsx`
```
import * as React from 'react'
import * as Helmet from 'react-helmet'
import * as classNames from 'classnames'
import {Link, withRouter} from 'react-router'
import {throttle} from 'lodash'
import { Icon } from 'graphcool-styles'
import ServerLayover from '../ServerLayover/ServerLayover'
import {chapters, neighboorSubchapter, subchapters, getLastSubchapterAlias, Chapter} from '../../utils/content'
import {collectHeadings, buildHeadingsTree} from '../../utils/markdown'
import {slug} from '../../utils/string'
import {StoredState, getStoredState, update} from '../../utils/statestore'
import {initSmooch} from '../../utils/smooch'
import * as ReactGA from 'react-ga'
import { events } from '../../utils/events'

require('./style.css')

const styles: any = require('./App.module.styl')

const meta = [
  {
    name: 'description',
    content: 'Learn all you need about GraphQL & Apollo and how to use it with React, React Native, Expo, iOS, Vue & Angular', // tslint:disable-line
  },
  {property: 'og:type', content: 'website'},
  {property: 'og:title', content: 'Learn Apollo'},
  {property: 'og:description', content: 'A hands-on tutorial for Apollo GraphQL Client'},
  {property: 'og:image', content: 'https://learnapollo.com/images/facebook.png'},
  {property: 'og:image:width', content: '1200'},
  {property: 'og:image:height', content: '630'},
  {property: 'og:site_name', content: 'LEARNAPOLLO'},
  {name: 'twitter:card', content: 'summary_large_image'},
  {name: 'twitter:site', content: '@graphcool'},
  {name: 'twitter:title', content: 'Learn Apollo'},
  {name: 'twitter:description', content: 'A hands-on tutorial for Apollo GraphQL Client'},
  {name: 'twitter:image', content: 'https://learnapollo.com/images/twitter.png'},
]

interface Props {
  children: React.ReactElement<any>
  router: any
  params: any
  location: any
}

interface State {
  showLayover: boolean
  storedState: StoredState
  expandNavButtons: boolean
  showNav: boolean
}

class App extends React.Component<Props, State> {

  static childContextTypes = {
    storedState: React.PropTypes.object.isRequired,
    updateStoredState: React.PropTypes.func.isRequired,
  }

  constructor(props: Props) {
    super(props)

    if (props.location.query.code) {
      this.fetchEndpoint(props.location.query.code)
    }

    this.state = {
      showLayover: false,
      storedState: getStoredState(),
      expandNavButtons: false,
      showNav: false,
    }

    if (getStoredState().initialLoadTimestamp === null) {
      update(['initialLoadTimestamp'], Date.now())
    }

    this.onScroll = throttle(this.onScroll.bind(this), 100)
  }

  componentDidMount() {
    window.addEventListener('scroll', this.onScroll, false)

    this.onScroll()
    initSmooch().then(this.updateSmoochButton)
    this.updateSidebarTrack()
  }

  componentDidUpdate() {
    this.onScroll()
    this.updateSmoochButton()
    this.updateSidebarTrack()
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this.onScroll, false)

    this.updateSmoochButton()
    this.updateSidebarTrack()
  }

  getChildContext() {
    return {
      storedState: this.state.storedState,
      updateStoredState: this.updateStoredState,
    }
  }

  render() {
    const currentSubchapterAlias = this.props.params.subchapter
    const currentSubchapter = subchapters.find((s) => s.alias === currentSubchapterAlias)

    const headingsTree = currentSubchapter ? buildHeadingsTree(collectHeadings(currentSubchapter!.ast())) : []

    const nextSubchapter = neighboorSubchapter(currentSubchapterAlias, true)
    const previousSubchapter = neighboorSubchapter(currentSubchapterAlias, false)

    const lastSubchapterAlias = getLastSubchapterAlias(Object.keys(this.state.storedState.hasRead))
    const selectedTrackAlias: string = getStoredState().selectedTrackAlias

    const shouldDisplaySubchapters = (chapter: Chapter, selectedTrackAlias: string): boolean => {
      return !chapter.isTrack || selectedTrackAlias === chapter.alias
    }
    return (
      <div className='flex row-reverse'>
        <Helmet
          title='Learn Apollo | Hands-on GraphQL Tutorial'
          meta={meta}
        />
        <div className='absolute w-100 left0 right0 top0 o-80 z-999' style={{ background: 'rgba(208, 2, 27, 0.8)'}}>
          <a href='https://www.howtographql.com/react-apollo/0-introduction/' className='db white tc w-100 pa3'>
            Learn Apollo has been deprecated in favour of How to GraphQL. <b>Click here to continue.</b>
          </a>
        </div>
        <div className={styles.hamburger} onClick={this.toggleNav}>
          <div className={styles.hamburgerWrapper}/>
        </div>
        <div
          className={`
            flex flex-column vertical-line font-small fixed left-0 h-100 overflow-x-visible
            ${styles.sidebar}
          `}
          style={{
            width: 270,
            display: this.state.showNav ? 'flex' : 'none',
          }}
        >

          <div className='relative pb6 overflow-y-scroll' ref='sidenav'>
            <div className={styles.close} onClick={this.toggleNav}>
              <Icon
                src={require('../../assets/icons/close.svg')}
                width={25}
                height={25}
                color='rgba(0,0,0,0.5)'
              />
            </div>
            <Link to='/' onClick={this.toggleNav}>
              <h2 className='fw3 pa4 pb0 black flex items-center'>
                <span className='dib mr3 mrl-1'>
                  <Icon
                    src={require('../../assets/icons/logo.svg')}
                    width={22}
                    height={22}
                  />
                </span>
                Learn Apollo
              </h2>
            </Link>
            {chapters.map((chapter, index) => (
              <div
                className='flex flex-column'
                key={chapter.alias}
              >
                <Link
                  className='fw6 ph4 pb3 black'
                  to={`/${chapter.alias}/${chapter.subchapters[0].alias}`}
                  onClick={() => this.setTrack(chapter.alias)}
                  style={{
                    paddingBottom: '0.5rem',
                    paddingTop: '1rem',
                  }}
                >
                  <span className='mr3 o-20 bold'>{index + 1}</span> {chapter.title}
                </Link>
                {shouldDisplaySubchapters(chapter, selectedTrackAlias) && chapter.subchapters.map((subchapter, subIndex) => (
                  <div
                    className='pb1'
                    key={subchapter.alias}
                  >
                    <div
                      className={`
                      relative
                      ${this.props.params.subchapter === subchapter.alias ? 'ph4 bg-black-05' : 'ph4'}
                      ${this.props.params.subchapter === subchapter.alias ? styles.currentProgressBar : ''}
                      `}
                      onClick={this.toggleNav}
                      style={{
                        paddingTop: '0.5rem',
                        paddingBottom: '0.5rem',
                      }}
                    >
                      {subchapter.alias === lastSubchapterAlias &&
                      <div className={styles.progressBar}/>
                      }
                      {this.state.storedState.hasRead[subchapter.alias] &&
                      <span className='mr3 fw5 green dib'>
                        <Icon
                          src={require('../../assets/icons/check_chapter.svg')}
                          width={8}
                          height={8}
                          color={'#64BF00'}
                        />
                      </span>
                      }
                      <div
                        ref={`link-${slug(subchapter.alias)}`}
                        className='dib'
                      >
                        {!this.state.storedState.hasRead[subchapter.alias] &&
                        <span
                          className='mr3 fw5 green dib'
                          style={{
                            width: 8,
                            height: 8,
                          }}
                        />
                        }
                        <Link
                          to={`/${chapter.alias}/${subchapter.alias}`}
                          className='black fw3'
                          onClick={this.toggleNav}
                        >
                          0{subIndex + 1} - {subchapter.title}
                        </Link>
                      </div>
                    </div>
                    {chapter.alias === this.props.params.chapter &&
                    subchapter.alias === this.props.params.subchapter &&
                    headingsTree.map((h) => (
                      <a
                        onClick={this.toggleNav}
                        key={h.title!}
                        className={`flex flex-row flex-start black ${styles.subchapter}`}
                        href={`#${slug(h.title!)}`}
                      >
                        <div className='ml4 mr2 fw5 bold o-20 black rotate-180 dib indent-char-dimensions'>¬</div>
                        <div>{h.title}</div>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {this.state.storedState.user && this.state.storedState.user.projectId &&
          <div
            className={`
              fixed bottom-0 left-0 flex fw3 items-center justify-center flex-row bg-accent pointer
              ${styles.serverButton}
            `}
            style={{ width: 269, height: 90 }}
            onClick={this.openLayover}
          >
            <Icon
              src={require('../../assets/icons/graphcool-logo.svg')}
              width={22}
              height={24}
              className='pt1'
              color='#f
```

### Core Architecture Module: `src/components/BrowserRow/BrowserRow.tsx`
```
import * as React from 'react'
import * as Relay from 'react-relay'
import { Icon } from 'graphcool-styles'
import DeletePokemonMutation from '../../mutations/DeletePokemonMutation'
import UpdatePokemonMutation from '../../mutations/UpdatePokemonMutation'
import * as ReactGA from 'react-ga'
import { events } from '../../utils/events'

const styles: any = require('./BrowserRow.module.styl')

interface Props {
  pokemon: any
  viewerId: string
}

interface State {
  id: string
  name: string
  url: string
  hover: boolean
  changesMade: boolean
}

class BrowserRow extends React.Component<Props, State> {

  state = {
    id: this.props.pokemon.id,
    name: this.props.pokemon.name,
    url: this.props.pokemon.url,
    hover: false,
    changesMade: false,
  }

  render() {
    return (
      <div
        className={`w-100 flex relative ${styles.tableRow}`}
        onMouseEnter={() => this.setState({hover: true} as State)}
        onMouseLeave={() => this.setState({hover: false} as State)}
      >
        <input
          style={{
            minWidth: '30%',
            padding: 12,
            boxSizing: 'border-box',
            borderLeft: '1px solid #E5E5E5',
          }}
          value={this.state.id}
          disabled
        />
        <input
          onBlur={this.updatePokemon}
          style={{
            minWidth: '30%',
            padding: 12,
            boxSizing: 'border-box',
          }}
          value={this.state.name}
          onChange={(e: any) => this.setState({name: e.target.value, changesMade: true} as State)}
        />
        <input
          style={{minWidth: '40%', padding: 12, boxSizing: 'border-box'}}
          value={this.state.url}
          onBlur={this.updatePokemon}
          onChange={(e: any) => this.setState({url: e.target.value, changesMade: true} as State)}
        />
        {this.state.hover &&
        <div
          className='flex items-center absolute bg-white'
          style={{padding: 10, right: 0, height: 'calc(100% - 4px)', boxSizing: 'border-box', margin: 2}}
        >
          <Icon
            onClick={this.removePokemon}
            className='pointer dim'
            width={18}
            height={18}
            src={require('../../assets/icons/delete.svg')}
          />
        </div>
        }
      </div>
    )
  }

  private removePokemon = () => {
    ReactGA.event(events.OverlayDeletePokemon)
    Relay.Store.commitUpdate(
      new DeletePokemonMutation({viewerId: this.props.viewerId, pokemonId: this.props.pokemon.id}),
    )
  }

  private updatePokemon = () => {
    ReactGA.event(events.OverlayUpdatePokemon)
    if (this.state.changesMade) {
      Relay.Store.commitUpdate(
        new UpdatePokemonMutation({pokemonId: this.props.pokemon.id, name: this.state.name, url: this.state.url}),
      )
    }
  }
}

export default Relay.createContainer(BrowserRow, {
  fragments: {
    pokemon: () => Relay.QL`
      fragment on Pokemon {
        id
        name
        url
      }
    `,
  },
})

```

### Core Architecture Module: `src/components/BrowserView/BrowserView.tsx`
```
import * as React from 'react'
import * as Relay from 'react-relay'
import { Icon } from 'graphcool-styles'
import AddPokemonMutation from '../../mutations/AddPokemonMutation'
import BrowserRow from '../BrowserRow/BrowserRow'
import * as ReactGA from 'react-ga'
import { events } from '../../utils/events'

const styles: any = require('./BrowserView.module.styl')

interface Props {
  viewer: any
}

interface State {
  name: string
  url: string
}

class BrowserView extends React.Component<Props, State> {

  state = {
    name: '',
    url: '',
  }

  render() {
    return (
      <div style={{height: 280, padding: 20, overflow: 'auto'}}>
        <div className='flex' style={{color: 'rgba(0,0,0,0.25)'}}>
          <div className='ttu' style={{padding: '0 0 13px 13px', minWidth: '30%'}}>
            Pokemon-Id
          </div>
          <div className='ttu' style={{padding: '0 0 13px 13px', minWidth: '30%'}}>
            Name
          </div>
          <div className='ttu' style={{padding: '0 0 13px 13px', minWidth: '40%'}}>
            Image Url
          </div>
        </div>
        <div className='overflow-auto' style={{paddingBottom: 20}}>
          {this.props.viewer.allPokemons.edges.map((edge) => edge.node).map(
            (node) => <BrowserRow key={node.id} pokemon={node} viewerId={this.props.viewer.id}/>,
          )}
          <div className={`w-100 flex relative ${styles.newRow}`}>
            <input
              className='i bg-transparent accent'
              style={{
                minWidth: '30%',
                padding: '12px',
                boxSizing: 'border-box',
              }}
              value={'Add new Pokémon (id will be generated)'}
              disabled
            />
            <input
              className='bg-transparent accent'
              placeholder='insert Pokemon name'
              style={{
                minWidth: '30%',
                padding: '12px',
                boxSizing: 'border-box',
              }}
              value={this.state.name}
              onChange={(e: any) => this.setState({name: e.target.value} as State)}
              onKeyDown={(e) => e.keyCode === 13 && this.addPokemon()}
            />
            <input
              className='bg-transparent accent'
              placeholder='insert an image url'
              style={{
                minWidth: '40%',
                padding: '12px',
                boxSizing: 'border-box',
              }}
              value={this.state.url}
              onChange={(e: any) => this.setState({url: e.target.value} as State)}
              onKeyDown={(e) => e.keyCode === 13 && this.addPokemon()}
            />
            {this.state.name && this.state.url &&
            <div className='flex items-center absolute h-100' style={{right: 10}}>
              <Icon
                onClick={this.addPokemon}
                className='pointer dim'
                width={24}
                height={24}
                src={require('../../assets/icons/check.svg')}
              />
            </div>
            }
          </div>
        </div>
      </div>
    )
  }

  private addPokemon = () => {
    ReactGA.event(events.OverlayCreatePokemon)

    Relay.Store.commitUpdate(
      new AddPokemonMutation({
        viewer: this.props.viewer,
        name: this.state.name,
        url: this.state.url,
        trainerId: this.props.viewer.allTrainers.edges[0].node.id,
      }),
      {
        onSuccess: () => this.setState({name: '', url: ''}),
      },
    )
  }
}

export default Relay.createContainer(BrowserView, {
  fragments: {
    viewer: () => Relay.QL`
      fragment on Viewer {
        allTrainers(first: 1) {
            edges {
                node {
                    id
                }
            }
        }
        allPokemons (first: 1000) {
          edges {
            node {
              id
              ${BrowserRow.getFragment('pokemon')}
            }
          }
        }
      }
    `,
  },
})

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #91** (2018-02-01): **Fix CORS**
  *Symptoms*: Currently the login all over the app is broken.  ![screenie](https://user-images.githubusercontent.com/1265681/30100056-d63d4354-92e7-11e7-9af8-6393529ef371.jpg)   **Browser:** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36`
  **Post-Mortem & Fix Analysis**:
  > The same for me.
  > Hey there, the Learn Apollo tutorial has been deprecated 🙂  Please check https://www.howtographql.com/ instead.
  > @marktani  https://www.howtographql.com/  has a lot of unresolved issues too 👎 

- **Issue #87** (2017-07-22): **Updating iOS Tutorial Exercice 4**
  *Symptoms*: Replacing `tableView.reloadSections([Sections.pokemons.rawValue], with: .none)` with `tableView.reloadData()` because the greetings label does not get updated with the ownedPokemons count.

- **Issue #86** (2017-07-22): **Updating trainer name in iOS tutorial Exercice 5**
  *Symptoms*: Replacing "Nikolas" with "__NAME__"

- **Issue #85** (2017-07-22): **Fixing typo in iOS tutorial Exercice 5**
  *Symptoms*: Replacing 'chacheForKeyObject' with 'cacheForKeyObject'
  **Post-Mortem & Fix Analysis**:
  > Thanks! 🙌 

- **Issue #84** (2017-06-28): **update localhost port number**
  *Symptoms*: the playground app actually runs on port 4000
  **Post-Mortem & Fix Analysis**:
  > Thanks 🙏 

- **Issue #82** (2017-06-16): **Issue Loading Trainer Data, Exercise 2**
  *Symptoms*: I signed in through Github before downloading files, but when I run the custom-made TrainerQuery: `Trainer(name: "ramyanaga.99@gmail.com") {     name   }` the response returns null.
  **Post-Mortem & Fix Analysis**:
  > Could you and everyone else that is running into this issue please contact me in [Slack](https://slack.graph.cool)? My handle there is @nilan.
  > Closing this issue. See above for anyone that runs into this again 🙂 

- **Issue #81** (2017-06-16): **API contents not created**
  *Symptoms*: When starting the React track, I logged in with Github, downloaded the files as requested in the tutorial, got my endpoint: https://api.graph.cool/simple/v1/cj3n46i1777ou01732xhk4q6q and started running the examples.   I had no issues at first, but as soon as I got to the second lesson (https://www.learnapollo.com/tutorial-react/react-02) and tried to query for my "Trainer" entry, I realized the server would always return ```null```. It seems that for some reason no entities have been created in my API instance.  This is confirmed by trying to run queries using GraphiQL - all queries return ```null```.
  **Post-Mortem & Fix Analysis**:
  > Hey @pcstl, when did you log in with Github? Could you try this: https://github.com/learnapollo/learnapollo/issues/79#issuecomment-306420452?
  > Hello @marktani.  I logged in earlier today, around 1 PM (GMT-3).  I just tried following the steps described in #79 :  1. Revoked LearnApollo's authorization 2. Logged out of Github 3. Logged into LearnApollo  However, it kept giving me the same endpoint. I then tried this in an incognito window so I could be sure there wouldn't be any cookie or localStorage-related issues:  1. Opened LearnApollo. Instead of the endpoint, the prompt to log into GitHub showed up. 2. Logged into GitHub.  3. Was redirected back to LearnApollo.  However... It gave me the exact same endpoint as before, and the issue persists. I have reproduced the issue here: https://api.graph.cool/simple/v1/cj3n46i1777ou01732xhk4q6q?query=query%20%7B%0A%20%20Trainer(name%3A%20%22Pedro%20Castilho%22)%20%7B%0A%20%20%20%20name%0A%20%20%7D%0A%7D%0A
  > https://api.graph.cool/simple/v1/cj3n46i1777ou01732xhk4q6q?query=query%20%7B%0A%20%20allTrainers(first%3A%2010)%20%7B%0A%20%20%20%20name%0A%20%20%7D%0A%7D%0A  Here you can see that there are no Trainers created.

- **Issue #80** (2017-06-01): **TrainerQuery always returns a null**
  *Symptoms*: From someone who submitted an issue on twitter: "I was going through the react native tutorial on learnapollo.com but the TrainerQuery always returns a null."
  **Post-Mortem & Fix Analysis**:
  > I believe this is related to #79. The server doesn't seem to be generated correctly.
  > This is now fixed.

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

### Incident Patch 1: `5493e073` (2017-07-22)
**Commit Message**: Fixing typo in iOS tutorial Exercice 5

Replacing 'chacheForKeyObject' with 'cacheForKeyObject'

**File**: `content/tutorial-ios/ios-05.md` (modified, +1/-1)
```diff
@@ -139,7 +139,7 @@ If you're running the app now, you'll be disappointed that the promised automati
 
 ### Finalizing Automatic UI Updates
 
-First, we need to implement `chacheForKeyObject` on the `ApolloClient` which we can do right after we instantiate it in the method `application(_:, didFinishLaunchingWithOptions:)` of the `AppDelegate`. Go ahead and change the current implementation so that it looks as follows:
+First, we need to implement `cacheForKeyObject` on the `ApolloClient` which we can do right after we instantiate it in the method `application(_:, didFinishLaunchingWithOptions:)` of the `AppDelegate`. Go ahead and change the current implementation so that it looks as follows:
 
 ```swift@AppDelegate.swift
     func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplicationLaunchOptionsKey: Any]?) -> Bool {
```

---

### Incident Patch 2: `766dab39` (2017-05-28)
**Commit Message**: Update webpack.config.build.js

**File**: `webpack.config.build.js` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ module.exports = {
       __LAST_UPDATE__: '"' + new Date().toLocaleDateString() + '"',
       __GA_TRACKING_CODE__: '"UA-74131346-6"',
       __GITHUB_OAUTH_CLIENT_ID__: JSON.stringify(process.env.GITHUB_OAUTH_CLIENT_ID.toString()),
-      __LAMBDA_AUTH__: JSON.stringify(process.env.LAMBDA_AUTH.toString()),
+      __LAMBDA_AUTH__: '"https://learnx.graph.cool/prod/learnapollo"',
       __LAMBDA_DOWNLOAD_EXAMPLE__: '"https://dynamic-resources.graph.cool"',
       'process.env': {
         'NODE_ENV': JSON.stringify('production')
```

---

### Incident Patch 3: `cd9ff2f4` (2017-04-18)
**Commit Message**: react-native: add more explanation about how to fix the stale cache issue

**File**: `content/tutorial-react-native/react-native-06.md` (modified, +1/-1)
```diff
@@ -246,7 +246,7 @@ const deletePokemon = gql`
 `
 ```
 
-As before, Apollo Client will merge the previously known pokemons with the pokemons in this mutation response. As the previous known pokemons already contain the now deleted pokemons, the pokemon will still be in the Apollo's store after this deletion. As things like filters on fields exist, there is no way for Apollo to know that in our case, we are fetching all the pokemon ids there are and not only a subset. A quick fix to make things work, is to force fetch the trainer object whenever the pokedex is being rendered.
+As before, Apollo Client will merge the previously known pokemons with the pokemons in this mutation response. As the previous known pokemons already contain the now deleted pokemons, the pokemon will still be in the Apollo's store after this deletion. As things like filters on fields exist, there is no way for Apollo to know that in our case, we are fetching all the pokemon ids there are and not only a subset. A quick fix to make things work, is to force fetch the trainer object whenever the pokedex is being rendered. The `fetchPolicy: 'cache-and-network'` option tells Apollo to first return the result from cache (if it exists), and then return the network result once it's available.
 
 To do this, head over to the `Pokedex` component in `components/Pokedex.js` again and add the `fetchPolicy: 'cache-and-network'` option to the options of the query:
 
```

---

### Incident Patch 4: `b575bb8a` (2017-03-16)
**Commit Message**: fix ts

**File**: `custom.d.ts` (modified, +4/-1)
```diff
@@ -7,14 +7,17 @@ declare module 'graphiql'
 declare module 'react-copy-to-clipboard'
 declare module 'cuid'
 
-declare var fetch: any
 declare var Smooch: any
 declare var __LAST_UPDATE__: string
 declare var __LAMBDA_AUTH__: string
 declare var __LAMBDA_DOWNLOAD_EXAMPLE__: string
 declare var __GITHUB_OAUTH_CLIENT_ID__: string
 declare var __GA_TRACKING_CODE__: string
 
+interface Window {
+  Smooch: any
+}
+
 declare module 'react-relay' {
 
   // fragments are a hash of functions
```

**File**: `src/components/SharePanel/SharePanel.tsx` (modified, +1/-1)
```diff
@@ -112,6 +112,6 @@ export default class SharePanel extends React.Component<Props, {}> {
   private isDisplayed = () => {
     const lastTimestamp = getStoredState().initialLoadTimestamp
     const currentTimestamp = Date.now()
-    return (currentTimestamp - lastTimestamp) >= millUntilDisplay
+    return lastTimestamp && (currentTimestamp - lastTimestamp) >= millUntilDisplay
   }
 }
```

---

### Incident Patch 5: `68812003` (2017-03-10)
**Commit Message**: fix smooch

**File**: `src/index.tsx` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ if (__GA_TRACKING_CODE__) {
   })
 }
 
-if (Smooch) {
+if (window.Smooch) {
   Smooch.on('widget:opened', () => {
     ReactGA.event(events.SmoochOpened)
   })
```

**File**: `src/utils/smooch.ts` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 import {getStoredState} from './statestore'
 
 export function initSmooch(): Promise<void> {
-  if (!Smooch || navigator.userAgent === 'SSR') {
+  if (!window.Smooch || navigator.userAgent === 'SSR') {
     return Promise.resolve()
   }
 
```

---

### Incident Patch 6: `79c1d0bf` (2017-03-10)
**Commit Message**: doc(*): fix broken links

**File**: `CONTRIBUTING.md` (modified, +2/-2)
```diff
@@ -10,8 +10,8 @@ source files in [`content`](https://github.com/learnapollo/learnapollo/tree/mast
 
 ## Contributing to the Pokedex app
 
-Learn Apollo features a practical example app in [React](https://github.com/learnapollo/pokedex-react/blob/master/CONTRIBUTING.md), [Angular 2](https://github.com/learnapollo/pokedex-angular/blob/master/CONTRIBUTING.md), [React Native Vanilla](https://github.com/learnapollo/pokedex-react-native-vanilla/blob/master/CONTRIBUTING.md) and
-[React Native Expo](https://github.com/learnapollo/pokedex-react-native-exponent/blob/master/CONTRIBUTING.md) that follows along
+Learn Apollo features a practical example app in [React](https://github.com/learnapollo/pokedex-react), [Angular 2](https://github.com/learnapollo/pokedex-angular), [React Native Vanilla](https://github.com/learnapollo/pokedex-react-native-vanilla) and
+[React Native Expo](https://github.com/learnapollo/pokedex-react-native-exponent) that follows along
 the interactive guide. If you find some inconsistencies between the guide and the application or you want to contribute
 something else, head over to the respective project to find out more about the contributing workflow for the
 Pokedex app.
```

---

### Incident Patch 7: `4915e6fb` (2017-02-14)
**Commit Message**: fixed issues found by martijn

**File**: `content/tutorial-ios/ios-01.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ The app so far only consists of one table view controller that will display two
 
 ![Initial Screen](../images/ios-ex01-initial_screen.png "Initial Screen")
 
-## Installing The **Apollo iOS Client** With Cocoapods
+## Installing The Apollo iOS Client With Cocoapods
 
 The **Apollo iOS client** can be installed through Cocoapods or Carthage. Since we are using Cocoapods in this project, go ahead and open the `Podfile` and add the following line:
 
```

**File**: `content/tutorial-ios/ios-02.md` (modified, +12/-8)
```diff
@@ -95,26 +95,30 @@ public final class TrainerQuery: GraphQLQuery {
   public static let operationDefinition =
     "query Trainer {" +
     "  Trainer(name: \"__NAME__\") {" +
+    "    __typename" +
     "    id" +
     "    name" +
     "  }" +
     "}"
+  public init() {
+  }
 
-  public struct Data: GraphQLMapDecodable {
+  public struct Data: GraphQLMappable {
     public let trainer: Trainer?
 
-    public init(map: GraphQLMap) throws {
-      trainer = try map.optionalValue(forKey: "Trainer")
+    public init(reader: GraphQLResultReader) throws {
+      trainer = try reader.optionalValue(for: Field(responseName: "Trainer", arguments: ["name": "__NAME__"]))
     }
 
-    public struct Trainer: GraphQLMapDecodable {
-      public let __typename = "Trainer"
+    public struct Trainer: GraphQLMappable {
+      public let __typename: String
       public let id: GraphQLID
       public let name: String?
 
-      public init(map: GraphQLMap) throws {
-        id = try map.value(forKey: "id")
-        name = try map.optionalValue(forKey: "name")
+      public init(reader: GraphQLResultReader) throws {
+        __typename = try reader.value(for: Field(responseName: "__typename"))
+        id = try reader.value(for: Field(responseName: "id"))
+        name = try reader.optionalValue(for: Field(responseName: "name"))
       }
     }
   }
```

**File**: `src/utils/content.ts` (modified, +2/-2)
```diff
@@ -120,10 +120,10 @@ export const chapters: Chapter[] = [
     title: '03 - Advanced Queries',
     alias: 'ios-03',
   }, {
-    title: '04 - Basic Mutations',
+    title: '04 - Fragments',
     alias: 'ios-04',
   }, {
-    title: '05 - Fragments',
+    title: '05 - Basic Mutations',
     alias: 'ios-05',
   }, {
     title: '06 - More Mutations',
```

---

### Incident Patch 8: `c942e743` (2017-02-12)
**Commit Message**: fixed ios logo

**File**: `package.json` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@
     "commonmark": "^0.26.0",
     "commonmark-react-renderer": "^4.3.1",
     "cuid": "^1.3.8",
+    "graphcool-styles": "^0.0.102",
     "graphiql": "^0.9.2",
     "graphql": "^0.9.1",
     "immutable": "^3.8.1",
```

**File**: `src/assets/icons/logo-ios.svg` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+<?xml version="1.0" encoding="UTF-8" standalone="no"?>
+<svg width="256px" height="163px" viewBox="0 0 256 163" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid">
+	<g fill="#000000">
+		<path d="M9.463808,13.26432 C9.463808,16.065984 7.757824,18.13856 4.831232,18.13856 C2.394112,18.13856 0.565248,16.065984 0.565248,13.26432 C0.565248,10.58144 2.514944,8.388032 5.074944,8.388032 C7.757824,8.388032 9.463808,10.58144 9.463808,13.26432 L9.463808,13.26432 L9.463808,13.26432 Z M2.717696,159.768 L2.717696,47.70144 L7.31136,47.70144 L7.31136,159.768 L2.717696,159.768 L2.717696,159.768 Z"></path>
+		<path d="M160.100352,79.920576 C160.100352,136.4208 128.735232,162.10272 94.40256,162.10272 C59.33056,162.10272 30.928896,134.3216 30.928896,82.257344 C30.928896,28.794304 60.319744,0.0752 96.872448,0.0752 C132.683776,0.073152 160.100352,28.323264 160.100352,79.920576 L160.100352,79.920576 L160.100352,79.920576 Z M35.584,81.087936 C35.584,123.928 56.346624,157.208 94.619648,157.208 C133.158912,157.208 155.262976,122.904 155.262976,80.600512 C155.262976,41.371072 137.551872,5.569984 97.13664,5.569984 C56.721408,5.569984 35.584,39.278016 35.584,81.087936 L35.584,81.087936 L35.584,81.087936 Z"></path>
+		<path d="M176.959488,147.625408 C184.666112,152.761792 197.967872,157.722048 209.408,157.722048 C231.120896,157.722048 250.431488,142.532032 250.431488,120.174016 C250.431488,99.425728 237.568,88.6 215.728128,79.300032 C196.182016,70.97696 178.608128,61.943232 178.608128,39.763392 C178.608128,16.651712 196.816896,0.306624 221.564928,0.306624 C234.872832,0.306624 244.912128,4.042176 249.581568,7.310784 L247.724032,11.341248 C243.755008,8.541632 233.029632,4.974016 221.35808,4.974016 C195.203072,4.974016 183.810048,24.737216 183.810048,39.286208 C183.810048,59.381184 199.387136,66.100672 219.465728,75.673024 C242.812928,87.113152 255.184896,97.197504 255.184896,119.14592 C255.184896,142.726592 238.37696,161.869248 208.492544,161.869248 C196.11648,161.869248 181.876736,157.666752 174.872576,152.296896 L176.959488,147.625408 L176.959488,147.625408 Z"></path>
+	</g>
+</svg>
\ No newline at end of file
```

**File**: `src/components/App/App.tsx` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ import * as React from 'react'
 import * as classNames from 'classnames'
 import {Link, withRouter} from 'react-router'
 import {throttle} from 'lodash'
-import Icon from '../Icon/Icon'
+import { Icon } from 'graphcool-styles'
 import ServerLayover from '../ServerLayover/ServerLayover'
 import {chapters, neighboorSubchapter, subchapters, getLastSubchapterAlias, Chapter} from '../../utils/content'
 import {collectHeadings, buildHeadingsTree} from '../../utils/markdown'
```

**File**: `src/components/BrowserRow/BrowserRow.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import * as React from 'react'
 import * as Relay from 'react-relay'
-import Icon from '../Icon/Icon'
+import { Icon } from 'graphcool-styles'
 import DeletePokemonMutation from '../../mutations/DeletePokemonMutation'
 import UpdatePokemonMutation from '../../mutations/UpdatePokemonMutation'
 import * as ReactGA from 'react-ga'
```

**File**: `src/components/BrowserView/BrowserView.tsx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 import * as React from 'react'
 import * as Relay from 'react-relay'
-import Icon from '../Icon/Icon'
+import { Icon } from 'graphcool-styles'
 import AddPokemonMutation from '../../mutations/AddPokemonMutation'
 import BrowserRow from '../BrowserRow/BrowserRow'
 import * as ReactGA from 'react-ga'
```

**File**: `src/components/ContentEndpoint/ContentEndpoint.tsx` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import * as CopyToClipboard from 'react-copy-to-clipboard'
 import Loading from '../Loading/Loading'
 import { StoredState } from '../../utils/statestore'
 import Markdown from '../Markdown/Markdown'
-import Icon from '../Icon/Icon'
+import { Icon } from 'graphcool-styles'
 import { Parser } from 'commonmark'
 import * as ReactGA from 'react-ga'
 import { events } from '../../utils/events'
```

**File**: `src/components/Icon/Icon.tsx` (removed, +0/-51)
```diff
@@ -1,51 +0,0 @@
-import * as React from 'react'
-
-interface Props {
-  src: any
-  color?: string
-  width?: number
-  height?: number
-  className?: string
-  rotate?: number
-  style?: any
-  [key: string]: any
-}
-
-export default class Icon extends React.Component<Props, {}> {
-  render() {
-    const width = this.props.width || 16
-    const height = this.props.height || 16
-
-    const rotate = this.props.rotate || 0
-
-    const fillCode = this.props.color ? `fill="${this.props.color}"` : ''
-    const styleCode = `style="width: ${width}px; height: ${height}px"`
-    const html = this.props.src.replace(/<svg/, `<svg ${fillCode} ${styleCode}`)
-
-    const restProps = Object.assign({}, this.props)
-    delete restProps.width
-    delete restProps.height
-    delete restProps.color
-    delete restProps.src
-    delete restProps.className
-
-    const style = Object.assign(
-      {},
-      {
-        transform: `rotate(${rotate}deg)`,
-        WebkitTransform: `rotate(${rotate}deg)`,
-        display: 'flex',
-      },
-      this.props.style
-    )
-
-    return (
-      <i
-        {...restProps}
-        className={this.props.className}
-        style={style}
-        dangerouslySetInnerHTML={{ __html: html }}
-      />
-    )
-  }
-}
```

**File**: `src/components/Markdown/Markdown.tsx` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ import ContentEndpoint from '../ContentEndpoint/ContentEndpoint'
 import Sharing from '../Sharing/Sharing'
 import Download from '../Download/Download'
 import SetTrack from '../SetTrack/SetTrack'
-import Icon from '../Icon/Icon'
+import { Icon } from 'graphcool-styles'
 import CopyToClipboard from 'react-copy-to-clipboard'
 
 const styles: any = require('./Markdown.module.css')
```

---

### Incident Patch 9: `869266c3` (2017-02-11)
**Commit Message**: fixed slug

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
 *.log
 node_modules/
 .idea
+.envrc
 dist/
 lib/
 .prep/
```

**File**: `custom.d.ts` (modified, +0/-1)
```diff
@@ -3,7 +3,6 @@ declare module 'react-router'
 declare module 'react-router-relay'
 declare module 'react-router-scroll'
 declare module 'commonmark-react-renderer'
-declare module 'slug'
 declare module 'graphiql'
 declare module 'react-copy-to-clipboard'
 declare module 'cuid'
```

**File**: `package.json` (modified, +34/-34)
```diff
@@ -9,7 +9,7 @@
   "dependencies": {
     "@types/classnames": "^0.0.32",
     "@types/commonmark": "^0.22.29",
-    "@types/immutable": "^3.8.4",
+    "@types/immutable": "^3.8.7",
     "@types/js-cookie": "^2.0.28",
     "@types/lodash": "^4.14.35",
     "@types/react": "^0.14.35",
@@ -19,22 +19,22 @@
     "commonmark": "^0.26.0",
     "commonmark-react-renderer": "^4.3.1",
     "cuid": "^1.3.8",
-    "graphiql": "^0.7.8",
-    "graphql": "^0.7.0",
+    "graphiql": "^0.9.2",
+    "graphql": "^0.9.1",
     "immutable": "^3.8.1",
     "js-cookie": "^2.1.3",
-    "lodash": "^4.17.2",
+    "lodash": "^4.17.4",
     "react": "^15.3.2",
     "react-addons-pure-render-mixin": "^15.3.2",
     "react-copy-to-clipboard": "^4.2.3",
     "react-dom": "^15.3.2",
     "react-ga": "^2.1.2",
     "react-prism": "^4.0.0",
-    "react-relay": "^0.9.3",
+    "react-relay": "^0.10.0",
     "react-router": "^2.8.1",
     "react-router-relay": "^0.13.5",
-    "react-router-scroll": "^0.3.2",
-    "slug": "^0.9.1",
+    "react-router-scroll": "^0.4.1",
+    "slugify": "^1.1.0",
     "whatwg-fetch": "^1.0.0"
   },
   "scripts": {
@@ -43,40 +43,40 @@
     "deploy": "npm run build && tsc --outDir .prep custom.d.ts prep.ts && prep -c .prep/prep.js dist && netlify deploy -p dist -s learnapollo -t $NETLIFY_TOKEN"
   },
   "devDependencies": {
-    "@types/node": "^6.0.39",
-    "awesome-typescript-loader": "^2.2.4",
-    "babel-cli": "^6.14.0",
-    "babel-jest": "^15.0.0",
-    "babel-loader": "^6.2.5",
-    "babel-plugin-react-relay": "^0.9.3-3",
-    "babel-plugin-transform-react-constant-elements": "^6.9.1",
-    "babel-plugin-transform-react-remove-prop-types": "^0.2.9",
-    "babel-plugin-transform-runtime": "^6.15.0",
-    "babel-preset-es2015": "^6.14.0",
-    "babel-preset-react": "^6.11.1",
+    "@types/node": "^7.0.5",
+    "awesome-typescript-loader": "^3.0.4-rc.2",
+    "babel-cli": "^6.22.2",
+    "babel-jest": "^18.0.0",
+    "babel-loader": "^6.2.10",
+    "babel-plugin-react-relay": "^0.10.0",
+    "babel-plugin-transform-react-constant-elements": "^6.22.0",
+    "babel-plugin-transform-react-remove-prop-types": "^0.3.2",
+    "babel-plugin-transform-runtime": "^6.22.0",
+    "babel-preset-es2015": "^6.22.0",
+    "babel-preset-react": "^6.22.0",
     "babel-preset-react-hmre": "^1.1.1",
-    "babel-preset-stage-0": "^6.5.0",
-    "babel-runtime": "^6.11.6",
-    "css-loader": "^0.25.0",
-    "cssnano": "^3.7.5",
-    "file-loader": "^0.9.0",
-    "html-webpack-plugin": "^2.22.0",
+    "babel-preset-stage-0": "^6.22.0",
+    "babel-runtime": "^6.22.0",
+    "css-loader": "^0.26.1",
+    "cssnano": "^3.10.0",
+    "file-loader": "^0.10.0",
+    "html-webpack-plugin": "^2.28.0",
     "json-loader": "^0.5.4",
     "netlify-cli": "^1.0.2",
-    "postcss-css-variables": "^0.5.2",
-    "postcss-loader": "^0.13.0",
+    "postcss-css-variables": "^0.6.0",
+    "postcss-loader": "^1.2.2",
     "prep": "^1.5.1",
     "raw-loader": "^0.5.1",
     "style-loader": "^0.13.1",
     "stylus": "^0.54.5",
-    "stylus-loader": "^2.3.1",
+    "stylus-loader": "^2.4.0",
     "svgo-loader": "^1.1.0",
-    "tachyons": "^4.5.2",
-    "tslint": "^3.15.1",
-    "tslint-config-standard": "^1.3.0",
-    "tslint-loader": "^2.1.5",
-    "typescript": "^2.0.6",
-    "webpack": "^2.1.0-beta.24",
-    "webpack-dev-server": "^2.1.0-beta.0"
+    "tachyons": "^4.6.2",
+    "tslint": "^4.4.2",
+    "tslint-config-standard": "^3.0.0",
+    "tslint-loader": "^3.3.0",
+    "typescript": "^2.1.6",
+    "webpack": "^2.2.1",
+    "webpack-dev-server": "^2.3.0"
   }
 }
```

**File**: `src/utils/string.ts` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-import * as _slug from 'slug'
+const _slug = require('slugify')
 
 export function slug(str: string): string {
   return _slug(str, {lower: true})
```

**File**: `webpack.config.build.js` (modified, +11/-11)
```diff
@@ -16,41 +16,41 @@ module.exports = {
     rules: [{
       enforce: 'pre',
       test: /\.ts(x?)$/,
-      loader: 'tslint',
+      loader: 'tslint-loader',
       exclude: /node_modules/,
     }, {
       test: /module\.styl/,
-      loader: 'style!css?modules!postcss!stylus',
+      loader: 'style-loader!css-loader?modules!postcss-loader!stylus-loader',
     }, {
       test: /module\.css/,
-      loader: 'style!css?modules!postcss',
+      loader: 'style-loader!css-loader?modules!postcss-loader',
     }, {
       test: /\.css/,
       exclude: /module\.css/,
-      loader: 'style!css!postcss',
+      loader: 'style-loader!css-loader!postcss-loader',
     }, {
       test: /\.ts(x?)$/,
       exclude: /node_modules/,
-      loader: 'babel!awesome-typescript',
+      loader: 'babel-loader!awesome-typescript-loader',
     }, {
       test: /\.js$/,
-      loader: 'babel',
+      loader: 'babel-loader',
       exclude: /node_modules/,
     }, {
       test: /\.json/,
-      loader: 'json',
+      loader: 'json-loader',
     }, {
       test: /\.(jpg|png)/,
-      loader: 'file',
+      loader: 'file-loader',
     }, {
       test: /content\/.*\.svg$/,
-      loader: 'file',
+      loader: 'file-loader',
     }, {
       test: /icons\/.*\.svg$/,
-      loader: 'raw!svgo?{"plugins":[{"removeStyleElement":true}]}',
+      loader: 'raw-loader!svgo-loader?{"plugins":[{"removeStyleElement":true}]}',
     }, {
       test: /\.md/,
-      loader: 'raw',
+      loader: 'raw-loader',
     }],
   },
   plugins: [
```

**File**: `webpack.config.js` (modified, +11/-11)
```diff
@@ -15,41 +15,41 @@ module.exports = {
     rules: [{
       enforce: 'pre',
       test: /\.ts(x?)$/,
-      loader: 'tslint',
+      loader: 'tslint-loader',
       exclude: /node_modules/,
     }, {
       test: /module\.styl/,
-      loader: 'style!css?modules!stylus',
+      loader: 'style-loader!css-loader?modules!stylus-loader',
     }, {
       test: /module\.css/,
-      loader: 'style!css?modules',
+      loader: 'style-loader!css-loader?modules',
     }, {
       test: /\.css/,
       exclude: /module\.css/,
-      loader: 'style!css',
+      loader: 'style-loader!css-loader',
     }, {
       test: /\.ts(x?)$/,
       exclude: /node_modules/,
-      loader: 'babel!awesome-typescript',
+      loader: 'babel-loader!awesome-typescript-loader',
     }, {
       test: /\.js$/,
-      loader: 'babel',
+      loader: 'babel-loader',
       exclude: /node_modules/,
     }, {
       test: /\.json/,
-      loader: 'json',
+      loader: 'json-loader',
     }, {
       test: /\.(jpg|png)/,
-      loader: 'file',
+      loader: 'file-loader',
     }, {
       test: /content\/.*\.svg$/,
-      loader: 'file',
+      loader: 'file-loader',
     }, {
       test: /icons\/.*\.svg$/,
-      loader: 'raw!svgo?{"plugins":[{"removeStyleElement":true}]}',
+      loader: 'raw-loader!svgo-loader?{"plugins":[{"removeStyleElement":true}]}',
     }, {
       test: /\.md/,
-      loader: 'raw',
+      loader: 'raw-loader',
     }],
   },
   plugins: [
```

---

### Incident Patch 10: `37428ac1` (2017-02-11)
**Commit Message**: fix smooch

**File**: `src/index.html` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
   <link href="https://fonts.googleapis.com/css?family=Source+Sans+Pro" rel="stylesheet">
   <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/prism/1.5.1/themes/prism.min.css">
   <script type="text/javascript" src="//cdnjs.cloudflare.com/ajax/libs/prism/1.5.1/prism.min.js"></script>
-  <!--<script src="https://cdn.smooch.io/smooch.min.js"></script>-->
+  <script src="https://cdn.smooch.io/smooch.min.js"></script>
   <script async defer src="https://buttons.github.io/buttons.js"></script>
 </head>
 <body>
```

---

### Incident Patch 11: `ee3aad4d` (2017-02-11)
**Commit Message**: fix AddPokemonCardWithMutation snippet

also added immutability-helper requirement as per original code snippet.

**File**: `content/excursions/excursion-02.md` (modified, +11/-3)
```diff
@@ -68,6 +68,12 @@ What we do here is to query all the pokemons our trainer owns whenever we create
 
 There is a more efficient way that leverages the `reducer` concept from Redux. When specifying a query or mutation, you can use `updateQueries` to define how the local store should be updated with the incoming query or mutation result.
 
+We will bring in `update` from `immutability-helper` - it will help us update the state without mutating the existing structure. You can find out more about it [here](https://github.com/kolodny/immutability-helper).
+
+```js
+import update from 'immutability-helper';
+```
+
 In our case, we want to update the `TrainerQuery` query:
 
 ```js
@@ -81,9 +87,11 @@ const AddPokemonCardWithMutation = graphql(createPokemonMutation, {
             TrainerQuery: (prev, { mutationResult }) => {
               const newPokemon = mutationResult.data.createPokemon
               return update(prev, {
-                ownedPokemons: {
-                  $push: [newPokemon],
-                },
+                Trainer: {
+                  ownedPokemons: {
+                    $push: [newPokemon],
+                  },
+                }
               })
             },
           },
```

---

### Incident Patch 12: `1d5bb6f1` (2017-02-09)
**Commit Message**: fixed typos

**File**: `content/tutorial-ios/ios-04.md` (modified, +3/-2)
```diff
@@ -24,7 +24,7 @@ In this lesson, we are going to learn about _fragments_. Fragments are a GraphQL
 
 ### Why Are Fragments Useful?
 
-With the new `PokemonDetailViewController` we now have have two differents areas in our app where we need to access a Pokemon's `name` and `url` (the `PokemonCell` is the second one). Currently, the only way for us to do so is by using the generated struct `TrainerQuery.Data.Trainer.OwnedPokemon` in both places. However, with this approach we are coupling the data requirements of the `PokemonCell` very tightly to the ones of our `PokemonDetailViewController`. This might turn out very inconvenient when our data requirements change in the future and suddenly one area should include more, less or complemetely different data. Fragments enable independent usage of the same data in various locations, which decouples the data requirements of different views and greatly improves our flexibility!
+With the new `PokemonDetailViewController` we now have have two differents areas in our app where we need to access a Pokemon's `name` and `url` (the `PokemonCell` is the second one). Currently, the only way for us to do so is by using the generated struct `TrainerQuery.Data.Trainer.OwnedPokemon` in both places. However, with this approach we are coupling the data requirements of the `PokemonCell` very tightly to the ones of our `PokemonDetailViewController`. This might turn out very inconvenient when our data requirements change in the future and suddenly one area should include more, less or completely different data. Fragments enable independent usage of the same data in various locations, which decouples the data requirements of different views and greatly improves our flexibility!
 
 
 ### Defining A Fragment
@@ -166,7 +166,8 @@ In the next exercise, we are going to learn about more mutations that allow us t
 
 ## Recap
 
-In this lesson, we learned about using fragments and why they are essential for using the **Apollo iOS client**. Let's revisit the key learning of this exercise:
+In this lesson, we learned about using fragments and why they are essential for using the **Apollo iOS client**. Let's revisit the key learnings of this exercise:
+
 - Fragments are a GraphQL feature that define sub-parts of a query
 - They can be reused in multiple queries and mutations
 - `apollo-codegen` generates one struct per fragment which allows to reuse similar information that originates from different queries or mutations
```

**File**: `content/tutorial-ios/ios-05.md` (modified, +3/-2)
```diff
@@ -1,4 +1,4 @@
-# Basic Mutations
+# Tutorial 05 - Basic Mutations
 
 Welcome to the 5th exercise in the **iOS Track** of this Apollo Client Tutorial!
 
@@ -174,7 +174,8 @@ To quickly re-iterate, the main reason why this automatic update happens is beca
 
 ## Recap 
 
-In this exercise, we added functionality to our app that allows to add a new Pokemon to our Pokedex and take advantage of the caching and automatic UI updates that's implementing in the **Apollo iOS client**. Here is a summary of what we learned:
+In this exercise, we added functionality to our app that allows to add a new Pokemon to our Pokedex and take advantage of the caching and automatic UI updates that's implemented in the **Apollo iOS client**. Here is a summary of what we learned:
+
 - _Mutations_ are used in GraphQL to update data in the backend
 - Syntactically, they are similar to queries but use the keyword `mutation` instead of `query`
 - `apollo-codegen` will generate one class per _mutation_
```

---

### Incident Patch 13: `d60c0c47` (2017-02-09)
**Commit Message**: fixed typo

**File**: `content/tutorial-ios/ios-04.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ Welcome to the 4th exercise in the **iOS Track** of this Apollo Client Tutorial!
 
 ## Goal
 
-In this exercise, our **goal** is to display a _detail view_ for a Pokemon when the user selects it in the table view. Therefore, we are going to learn about a new GraphQL feature that allow to reuse sub-parts of a query: Fragments! 
+In this exercise, our **goal** is to display a _detail view_ for a Pokemon when the user selects it in the table view. Therefore, we are going to learn about a new GraphQL feature that allows us to reuse sub-parts of a query: Fragments! 
 
 
 ## Introduction
```

---

### Incident Patch 14: `18240c80` (2017-02-09)
**Commit Message**: updated tutorial to include caching and automatic UI updates

**File**: `content/tutorial-ios/ios-03.md` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ In this exercise we will have a look at advanced query features with the **goal*
 Open the directory that contains the 3rd exercise (`exercise-03`) and open `pokedex-apollo.xcworkspace`. It already contains a running version of the code you wrote in the previous lesson. Note that we added a new class called `PokemonCell` that we will use to display your Pokemons in the second section of the table view. 
 
 
-## Display A List Of Pokemons With Advanced Queries Features
+## Display A List Of Pokemons With Advanced Query Features
 
 Before we start working directly on our goal to show the pokemons a trainer owns, let's take some time to get more familiar with some of the available options when using queries.
 
```

**File**: `content/tutorial-ios/ios-04.md` (modified, +115/-57)
```diff
@@ -1,117 +1,175 @@
-# Basic Mutations
+# Tutorial 04 - Fragments
 
 Welcome to the 4th exercise in the **iOS Track** of this Apollo Client Tutorial!
 
 
 ## Goal
 
-In this exercise, our **goal** is to add new Pokemons to the Pokedex. Therefore, we are going to learn about _mutations_.
+In this exercise, our **goal** is to display a _detail view_ for a Pokemon when the user selects it in the table view. Therefore, we are going to learn about a new GraphQL feature that allow to reuse sub-parts of a query: Fragments! 
 
 
 ## Introduction
 
-Open the directory that contains the 4th exercise (`exercise-04`) and open `pokedex-apollo.xcworkspace`. 
+Open the directory that contains the 4th exercise (`exercise-04`) and open `pokedex-apollo.xcworkspace`. It already contains a running version of the code you wrote in the previous lesson, however we made a few minor changes: We "untangled" the information about the trainer and now, rather than storing one property `trainer` of type `TrainerQuery.Data.Trainer` in `PokedexTableViewController`, we now store three individual properties which are the trainer's `id`, `name` and `ownedPokemons`. All parts of the code where `trainer` was used before have been updated accordingly.
 
-It already contains a running version of the code you wrote in the previous lesson, however we made a few minor changes: We "untangled" the information about the trainer and now, rather than storing one property `trainer` of type `TrainerQuery.Data.Trainer` in `PokedexTableViewController`, we now store three individual properties which are the trainer's `id`, `name` and `ownedPokemons`. All parts of the code where `trainer` was used before have been updated accordingly.
+We also added a new view controller called `PokemonDetailViewController` that is shown when a Pokemon in the table view is tapped. This view controller currently is empty when it's shown, so we need to make sure that it displays the correct data.
 
-We also added a new view controller called `CreatePokemonViewController` that will allow us to enter data for a new Pokemon in our Pokedex. When segueing from the `PokedexTableViewController` to the `CreatePokemonViewController` we are passing the trainer's ID, so that we can provide this information upon creation of a new Pokemon.
 
+## Fragments
 
-## Using _Mutations_ To Add New Pokemons
+In this lesson, we are going to learn about _fragments_. Fragments are a GraphQL feature that allow to define and reuse _sub-parts_ of a query independently. With Swift's strong type system, they're actually quite an essential tool in using the **Apollo iOS client** whereas in JavaScript they're more of a convenience to save typing and improve structuring of your GraphQL queries.
 
-### Mutations In GraphQL
 
-So far, we only learned about _queries_, a GraphQL concept that allows us to _fetch_ data from an API. However, in most applications we actually also want to be able to change the data in the backend either by updating existing data entries or creating completely new ones. In GraphQL, this can be done via _mutations_.
+## Using Fragments To Decouple Data Requirements
 
-Mutations are very similar to _queries_, but when defining them in our `.graphql` files, we need to use the keyword `mutation` instead of `query`. The **Apollo iOS client** will then, similar to queries, generate one class per mutation.
+### Why Are Fragments Useful?
 
+With the new `PokemonDetailViewController` we now have have two differents areas in our app where we need to access a Pokemon's `name` and `url` (the `PokemonCell` is the second one). Currently, the only way for us to do so is by using the generated struct `TrainerQuery.Data.Trainer.OwnedPokemon` in both places. However, with this approach we are coupling the data requirements of the `PokemonCell` very tightly to the ones of our `PokemonDetailViewController`. This might turn out very inconvenient when our data requirements change in the future and suddenly one area should include more, less or complemetely different data. Fragments enable independent usage of the same data in various locations, which decouples the data requirements of different views and greatly improves our flexibility!
 
-### Adding a New Pokemon
 
-Let's see what a mutation for adding a new Pokemon would look like (again, wait with copying the mutation, we will create `CreatePokemonViewController.graphql` in a second):
+### Defining A Fragment
 
-```graphql@CreatePokemonViewController.graphql
-mutation CreatePokemon($name: String, $url: String!, $trainerId: ID) {
-  createPokemon(name: $name, url: $url, trainerId: $trainerId) {
-    id
-    name
-    url
-  }
+Fragments are defined on a specific _type_ from our GraphQL schema and can then be inserted into queries to represent the data that they contain. We are going to define the fragment on the `Pokemon` type, as this is the type that contains the information that we want to use in multiple locations.
+
+This is what the definition of a 
```

**File**: `content/tutorial-ios/ios-05.md` (modified, +109/-144)
```diff
@@ -1,224 +1,189 @@
-# Tutorial 05 - Fragments
+# Basic Mutations
 
 Welcome to the 5th exercise in the **iOS Track** of this Apollo Client Tutorial!
 
 
 ## Goal
 
-The **goal** of this exercise is to update our table view instantly after adding new Pokemon to the Pokedex. We also want to create a _detail view_ for the Pokemon in our Pokedex. Therefore, we are going to use another GraphQL feature called _fragments_. 
+In this exercise, our **goal** is to add new Pokemons to the Pokedex. Therefore, we are going to learn about _mutations_.
 
 
 ## Introduction
 
-Open the directory that contains the 5th exercise (`exercise-05`) and open `pokedex-apollo.xcworkspace`. It already contains a running version of the code you wrote in the previous lesson. Note that we added another view controller called `PokemonDetailViewController` that is shown when a Pokemon in the table view is tapped. We will deal with this in the last part of this lesson after making sure the table view updates after adding a new Pokemon.
+Open the directory that contains the 5th exercise (`exercise-0`) and open `pokedex-apollo.xcworkspace`. 
 
+It already contains a running version of the code you wrote in the previous lesson.
+We again added a new view controller called `CreatePokemonViewController` that will allow us to enter data for a new Pokemon in our Pokedex. When segueing from the `PokedexTableViewController` to the `CreatePokemonViewController` we are passing the trainer's ID, so that we can send this information along to the server to associate the trainer with the new Pokemon.
 
-## Fragments
 
-In this lesson, we are going to learn about _fragments_. Fragments are a GraphQL feature that allow to define and reuse _sub-parts_ of a query independently. With Swift's strong type system, they're actually quite an essential tool in using the **Apollo iOS client** whereas in JavaScript they're more of a convenience to save typing and improve structuring of your GraphQL queries.
+## Using _Mutations_ To Add New Pokemons
 
+### Mutations In GraphQL
 
-## Using Fragments To Update The Pokedex UI
+So far, we only learned about _queries_, a GraphQL concept that allows us to _fetch_ data from an API. However, in most applications we actually also want to be able to change the data in the backend either by updating existing data entries or creating completely new ones. In GraphQL, this can be done via _mutations_.
 
-### Defining A Fragment
+Mutations are very similar to _queries_, but when defining them in our `.graphql` files, we need to use the keyword `mutation` instead of `query`. The **Apollo iOS client** will then, similar to queries, generate one class per mutation.
 
-Fragments are defined on a specific _type_ from our GraphQL schema. We are going to define the fragment on the `Pokemon` type, as we had the problem that our types `TrainerQuery.Data.Trainer.OwnedPokemon` and `CreatePokemonMutation.Data.CreatePokemon` didn't match up despite the fact that they carry the same information.
 
-So, let's go and solve this by defining a reusable fragment that we can inject into the query and into the mutation so that `apollo-codegen` generates a type for that fragment which we can then use in multiple locations.
+### Adding a New Pokemon
 
-We will need the fragment on the `Pokemon` type, its definition looks as follows:
+Let's see what a mutation for adding a new Pokemon would look like (again, wait with copying the mutation, we will create `CreatePokemonViewController.graphql` in a second):
 
-```graphql@PokedexTableViewController.graphql
-fragment PokemonDetails on Pokemon {
-  id
-  name
-  url
+```graphql@CreatePokemonViewController.graphql
+mutation CreatePokemon($name: String, $url: String!, $trainerId: ID) {
+  createPokemon(name: $name, url: $url, trainerId: $trainerId) {
+    id
+    name
+    url
+  }
 }
 ```
 
-The definition of a fragment begins with the keyword `fragment`. Then follows the name of the fragment (in our case that is `PokemonDetails`) and the GraphQL type on which we define the fragment, so here this is `Pokemon`.
-
-The next question is, where exactly should we define this fragment? The data that is represented by this fragment will be used in multiple locations:
-- `PokemonCell`
-- `PokedexTableViewController`
-- `CreatePokemonViewController`
-- `PokemonDetailViewController`
+> Note: Similar to queries, you can execute this mutation in [GraphiQL](https://api.graph.cool/simple/v1/__PROJECT_ID__). Don't forget to add the query variables for `$name`, `$url` and (potentially) `$trainerId`. 
 
-As it is used all over the place, let's just go and add it to the `PokedexTableViewController.graphql` which is also responsible for initially fetching it. We could also create a new `.graphql` file and put the fragment in there - remember that all `.graphql` will be merged by `apollo-codegen`. So, no matter where we define the fragment, it will be available in all other queries and mutations.
+The above mutation will create a 
```

**File**: `content/tutorial-ios/ios-06.md` (modified, +13/-77)
```diff
@@ -1,6 +1,6 @@
 # Tutorial 06 - More Mutations
 
-Welcome to the 6th exercise in the **iOS Track** of this Apollo Client Tutorial!
+Welcome to the 6th and last exercise in the **iOS Track** of this Apollo Client Tutorial!
 
 
 ## Goal
@@ -10,7 +10,7 @@ The **goal** of this exercise is to implement features for updating and deleting
 
 ## Introduction
 
-Open the directory that contains the 6th exercise (`exercise-06`) and open `pokedex-apollo.xcworkspace`. It already contains a running version of the code you wrote in the previous lesson. Note that we added some functionality to the `PokemonDetailViewController` that allows us to switch to an _editing state_ in which we can change the name and image URL using the corresponding text fields. However, any changes that we make right now will have no effect - that's what we want to implement in this exercise.
+Open the directory that contains the 6th exercise (`exercise-06`) and open `pokedex-apollo.xcworkspace`. It already contains a running version of the code you wrote in the previous lesson. Note that we added some functionality to the `PokemonDetailViewController` that allows us to switch to an _editing state_ in which we can change the name and image URL using the corresponding text fields. However, any changes that we make right now will have no effect in our backend - that's what we want to implement in this exercise.
 
 
 ## Updating An Existing Pokemon
@@ -69,41 +69,9 @@ else {
 
 That's a lot of code, let's try to understand what it does! In the very beginning, we check if we're currently in the _editing state_ - if that is the case we are going to perform the mutation using the strings that are written in the text fields. Therefore, we first make sure that the required data is provided using a `guard` statement. We then start the activity indicator to indicate to the user that a network request has started. Finally, we instantiate the `UpdatePokemonMutation` that was generated by `apollo-codegen` based on the mutation we added in `PokemonDetailViewController.graphql`. Subsequently, we call `perform` on our `ApolloClient` instance passing the instance of the mutation as well as a callback to deal with the return value. Since we are using our `PokemonDetails` fragment again, we can simply extract this from the return value inside the callback and assign it the `pokemonDetails` property. This will automatically update the UI because of the `didSet` property observer. 
 
-Go ahead and test the new feature by modifying the name or image URL of one of the Pokemons in your Pokedex. You should see the UI being updated with the new values after a successful completion of the mutation. However, once again, if we navigate back to the `PokedexTableViewController`, the changes won't be reflected in the table view yet. You'll only actually see the changes after restarting the app.
+Go ahead and test the new feature by modifying the name or image URL of one of the Pokemons in your Pokedex. You should see the UI being updated with the new values after a successful completion of the mutation. 
 
-
-### Updating The UI
-
-That is because the data in the `ownedPokemons` array in `PokedexTableViewController` is independent from the data we just updated in `PokemonDetailViewController` (because of the _value semantics_ of structs in Swift), so we have to manually update it. Let's do so again with a closure. Add the following property to `PokemonDetailViewController`:
-
-```swift@PokemonDetailViewController.swift
-var updatedPokemon: ((PokemonDetails) -> ())?
-``` 
-
-Then, call the closure in `viewWillDisappear(_ animated: Bool)` like so:
-
-```swift@PokemonDetailViewController.swift
-override func viewWillDisappear(_ animated: Bool) {
-    super.viewWillDisappear(animated)
-    updatedPokemon?(pokemonDetails)
-}
-```
-
-Finally, assign the closure in `prepare(for segue: UIStoryboardSegue, sender: Any?)` in `PokedexTableViewController`:
-
-```swift@PokedexTableViewController.swift
-pokemonDetailViewController.updatedPokemon = { [unowned self] pokemonDetails in
-    if let index = self.ownedPokemons?.index(where: { pokemonDetailsInArray in
-        return pokemonDetailsInArray.id == pokemonDetails.id
-    }) {
-        self.ownedPokemons?[index] = pokemonDetails
-    }
-}
-```
-
-We first search for the right `PokemonDetails` in the `ownedPokemons` array and then replace it with the updated instance.
-
-Great, that was all you need in order to make sure the updated Pokemon data is reflected in the table view when navigating back! Let's now add the final bit of functionality which is to delete a Pokemon.
+Thanks to the caching and automatic update functionality that we saw in the previous exercise, you'll also see the updated Pokemon data in the table view if you navigate back to the `PokedexTableViewController`. Let's now add the final bit of functionality which is to delete a Pokemon.
 
 
 ## Deleting An Existing Pokemon
@@ -114,13 +82,18 @@ In order to delete a Pokemon
```

---

### Incident Patch 15: `9dfe5125` (2017-02-01)
**Commit Message**: Fix: src/package.json => package.json

**File**: `content/tutorial-react-native-vanilla/rnv-01.md` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ Let's see how we can add Apollo Client to our App together by adding these chang
 
 ### Package Dependencies
 
-Open `src/package.json` to have a look what packages we are using.
+Open `package.json` to have a look what packages we are using.
 
 * `apollo-client` - the core package exposes the vanilla JS Apollo Client which provides the core functionality
 * `react-apollo` - the React integration exposes the `ApolloProvider` that can be used to wrap other React components, allowing them to send queries and mutations
```

#### Recent Merged Pull Requests:
- **PR #87** (2017-07-22): Updating iOS Tutorial Exercice 4 (@Kiesco08)
- **PR #86** (2017-07-22): Updating trainer name in iOS tutorial Exercice 5 (@Kiesco08)
- **PR #85** (2017-07-22): Fixing typo in iOS tutorial Exercice 5 (@Kiesco08)
- **PR #84** (2017-06-28): update localhost port number (@brianzelip)
- **PR #78** (2017-05-30): tutorial-ios-04 optional chaining typo (@spinach)
- **PR #76** (2017-05-05): Replace index.js with App.js in react-native-05.md (@grncdr)
- **PR #75** (2017-05-04): File path package.json (@fox-tails)
- **PR #74** (2017-04-28): Clarify section about dynamic query variables (@newswim)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
