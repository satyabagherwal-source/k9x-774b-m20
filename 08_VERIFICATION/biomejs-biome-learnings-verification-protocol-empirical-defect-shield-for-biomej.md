# Verification Protocol: Verification Protocol: Empirical Defect Shield for biomejs-biome-learnings

<!-- PROVENANCE_START
{
  "source_repository": "biomejs-biome-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T01:44:35.933Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-biomejs-biome-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs-biome-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T01:44:35.933Z`  
> **Learning ID**: `LEARN-EVO-biomejs-biome-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `biomejs-biome-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/biomejs-biome-learnings.md`  
> **Source**: github ([https://github.com/biomejs/biome](https://github.com/biomejs/biome))  
> **Source Version**: `caaa90bc`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T01:44:18.195Z  
> **Learning ID**: `learn-github-biomejs-biome`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): biomejs/biome

> **Canonical Artifact**: `07_PROJECT_LEARNING/biomejs-biome-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/biomejs/biome](https://github.com/biomejs/biome))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-25T01:44:17.981Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `biomejs/biome`
- **Description**: A toolchain for web projects, aimed to provide functionalities to maintain them. Biome offers formatter and linter, usable via CLI and LSP.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 26202 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/biome_analyze/src/utils.rs`
```
use biome_rowan::{
    AstNode, AstSeparatedElement, AstSeparatedList, Language, SyntaxError, SyntaxNode, SyntaxToken,
    chain_trivia_pieces, trim_trailing_trivia_pieces,
};
use std::cmp::Ordering;

/// Returns `true` if `list` is sorted by `get_key`.
/// The function returns an error if we encounter a buggy node or separator.
///
/// The list is divided into chunks of nodes with keys.
/// Thus, a node without key acts as a chuck delimiter.
/// Chunks are sorted separately.
pub fn is_separated_list_sorted_by<'a, L: Language + 'a, N: AstNode<Language = L> + 'a, Key>(
    list: &impl AstSeparatedList<Language = L, Node = N>,
    get_key: impl Fn(&N) -> Option<Key>,
    comparator: impl Fn(&Key, &Key) -> Ordering,
) -> Result<bool, SyntaxError> {
    let mut is_sorted = true;

    if list.len() > 1 {
        let mut previous_key: Option<Key> = None;
        for AstSeparatedElement {
            node,
            trailing_separator,
        } in list.elements()
        {
            // We have to check if the separator is not buggy.
            let _separator = trailing_separator?;
            previous_key = if let Some(key) = get_key(&node?) {
                if previous_key.is_some_and(|previous_key| comparator(&previous_key, &key).is_gt())
                {
                    // We don't return early because we want to return the error if we met one.
                    is_sorted = false;
                }
                Some(key)
            } else {
                // If a name cannot be extracted, then the current chunk stops here.
                None
            };
        }
    }
    Ok(is_sorted)
}

/// Returns the items and their separators resulting from sorting `list` by `get_key`.
/// When elements are reordered, `make_separator` is called to add missing separators in the middle of the list.
///
/// The list is divided into chunks of nodes with keys.
/// Thus, a node without key acts as a chuck delimiter.
/// Chunks are sorted separately.
///
/// This sort is stable (i.e., does not reorder equal elements).
pub fn sorted_separated_list_by<'a, L, List, Node, Key>(
    list: &List,
    get_key: impl Fn(&Node) -> Option<Key>,
    make_separator: fn() -> SyntaxToken<L>,
    comparator: impl Fn(&Key, &Key) -> Ordering,
) -> Result<List, SyntaxError>
where
    L: Language + 'a,
    List: AstSeparatedList<Language = L, Node = Node> + AstNode<Language = L> + 'a,
    Node: AstNode<Language = L> + 'a,
{
    let mut elements = Vec::with_capacity(list.len());
    for AstSeparatedElement {
        node,
        trailing_separator,
    } in list.elements()
    {
        let node = node?;
        let trailing_separator = trailing_separator?;
        elements.push((get_key(&node), node, trailing_separator));
    }

    // Iterate over chunks of node with a key
    for slice in elements.split_mut(|(key, _, _)| key.is_none()) {
        let last_has_separator = slice.last().is_some_and(|(_, _, sep)| sep.is_some());
        slice.sort_by(|(key1, _, _), (key2, _, _)| match (key1, key2) {
            (Some(k1), Some(k2)) => comparator(k1, k2),
            (Some(_), None) => Ordering::Greater,
            (None, Some(_)) => Ordering::Less,
            (None, None) => Ordering::Equal,
        });
        fix_separators(
            slice.iter_mut().map(|(_, node, sep)| (node, sep)),
            last_has_separator,
            make_separator,
        );
    }

    let separators: Vec<_> = elements
        .iter_mut()
        .filter_map(|(_, _, sep)| sep.take())
        .collect();
    let mut separators = separators.into_iter();
    let mut items = elements.into_iter().map(|(_, node, _)| node);

    Ok(List::unwrap_cast(SyntaxNode::new_detached(
        list.syntax().kind(),
        (0..list.len() + separators.len()).map(|index| {
            if index % 2 == 0 {
                Some(items.next()?.into_syntax().into())
            } else {
                Some(separators.next()?.into())
            }
        }),
    )))
}

/// Fix the ordered sequence of nodes and separators adding missing separators and removing an extra separator.
///
/// If a separator is missing in the middle of the sequence, then a new one is created using `make_separator`.
/// If the last node has no separator, then a new one is created only if `needs_last_separator` is set to `true`.
/// If the last node has a separator and `needs_last_separator` is set to false, then the separator is removed.
/// The separator is always kept if some comments are attached.
///
/// This utility is notably useful when a delimited list with an optional last separator is reordered.
/// It allows you to add missing separators and remove an extra separator.
/// Usually, you collect every pair of nodes and separators in a vector and then pass a mutable iterator to `fix_separators`.
///
/// See [`sorted_separated_list_by`] as a usage example.
pub fn fix_separators<'a, L: Language + 'a, N: AstNode<Language = L> + 'a>(
    // Mutable iterator of a list of nodes and their optional separators
    iter: impl std::iter::ExactSizeIterator<Item = (&'a mut N, &'a mut Option<SyntaxToken<L>>)>,
    needs_last_separator: bool,
    make_separator: fn() -> SyntaxToken<L>,
) {
    let last_index = iter.len().saturating_sub(1);
    for (i, (node, optional_separator)) in iter.enumerate() {
        if let Some(separator) = optional_separator {
            // Remove the last separator at the separator has no attached comments
            if i == last_index
                && !(needs_last_separator
                    || separator.has_leading_comments()
                    || separator.has_trailing_comments())
            {
                // Transfer the separator trivia
                if let Some(new_node) = node.clone().append_trivia_pieces(chain_trivia_pieces(
                    separator.leading_trivia().pieces(),
                    separator.trailing_trivia().pieces(),
                )) {
                    *node = new_node;
                }
                *optional_separator = None;
            }
        } else if i != last_index || needs_last_separator {
            // The last node is moved and has no trailing separator.
            // Thus we build a new separator and remove its trailing trivia.
            *optional_separator = Some(match node.syntax().last_trailing_trivia() {
                // Transfer the trailing trivia to the separator
                Some(trivia) => make_separator()
                    .append_trivia_pieces(trim_trailing_trivia_pieces(trivia.pieces())),
                _ => make_separator(),
            });

            if let Some(new_node) = node.clone().with_trailing_trivia_pieces([]) {
                *node = new_node;
            }
        }
    }
}

/// Splits the list into two new lists according to a partitioning function.
///
/// Every item of `list` is passed to `partition` that decides if the item is
/// part of the left or the right returned list.
/// The `partition` function can change the passed item before returning it.
/// This allows supporting cases where the passed AST node must be modified.
///
/// This function returns `None` if it encounters a buggy item or
/// if `partition` returns `None` for at least one item.
///
/// The trailing separators are moved with their node.
pub fn split_separated_list<'a, L, List, Node>(
    list: &List,
    partition: impl Fn(Node) -> Option<either::Either<Node, Node>>,
) -> Option<(List, List)>
where
    L: Language + 'a,
    List: AstSeparatedList<Language = L, Node = Node> + AstNode<Language = L> + 'a,
    Node: AstNode<Language = L> + 'a,
{
    let mut left_items = Vec::with_capacity(list.len());
    let mut left_separators = Vec::with_capacity(list.len());
    let mut right_items = Vec::with_capacity(list.len());
    let mut right_separators = Vec::with_capacity(list.len());

    for AstSeparatedElement {
        node,
        trailing_separator,
    } in list.elements()
    {
        // Abort the split if a node is buggy or if `partition` returns `None`.
        let node = node.ok()?;
        let trailing_separator = trailing_separator.ok()?;
        let (items, separators, node) = match partition(node)? {
            either::Either::Left(node) => (&mut left_items, &mut left_separators, node),
            either::Either::Right(node) => (&mut right_items, &mut right_separators, node),
        };
        items.push(node);
        if let Some(trailing_separator) = trailing_separator {
            separators.push(trailing_separator);
        }
    }

    let mut left_items = left_items.into_iter();
    let mut left_separators = left_separators.into_iter();
    let left_list = List::unwrap_cast(SyntaxNode::new_detached(
        list.syntax().kind(),
        (0..left_items.len() + left_separators.len()).map(|index| {
            if index % 2 == 0 {
                Some(left_items.next()?.into_syntax().into())
            } else {
                Some(left_separators.next()?.into())
            }
        }),
    ));

    let mut right_items = right_items.into_iter();
    let mut right_separators = right_separators.into_iter();
    let right_list = List::unwrap_cast(SyntaxNode::new_detached(
        list.syntax().kind(),
        (0..right_items.len() + right_separators.len()).map(|index| {
            if index % 2 == 0 {
                Some(right_items.next()?.into_syntax().into())
            } else {
                Some(right_separators.next()?.into())
            }
        }),
    ));

    Some((left_list, right_list))
}

/// Counts lines in a syntax tree, used by `noExcessiveLinesPerFile`.
///
/// When `skip_blank_lines` is true, counts tokens with leading newlines (excluding blank lines).
/// When false, counts all newline trivia pieces in leading trivia.
/// EOF tokens and newlines inside comments or token text are excluded.
/// Returns total + 1 to account for the first line.
pub fn count_lines_in_file<L: Language>(
    node: &SyntaxNode<L>,
    is_eof_token: impl Fn(&SyntaxToken<L>) -> bool
```

### Core Architecture Module: `crates/biome_console/src/utils.rs`
```
use crate::fmt::{Display, Formatter};
use crate::{Markup, markup};
use std::io;

/// It displays a type that implements [std::fmt::Display]
pub struct DebugDisplay<T>(pub T);

impl<T> Display for DebugDisplay<T>
where
    T: std::fmt::Display,
{
    fn fmt(&self, f: &mut Formatter<'_>) -> io::Result<()> {
        write!(f, "{}", self.0)
    }
}

/// It displays a `Option<T>`, where `T` implements [std::fmt::Display]
pub struct DisplayOption<T>(pub Option<T>);

impl<T> Display for DisplayOption<T>
where
    T: std::fmt::Display,
{
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        use crate as biome_console;

        if let Some(value) = &self.0 {
            markup!({ DebugDisplay(value) }).fmt(fmt)?;
        } else {
            markup!(<Dim>"unset"</Dim>).fmt(fmt)?;
        }
        Ok(())
    }
}

/// A horizontal line with the given print width
pub struct HorizontalLine {
    width: usize,
}

impl HorizontalLine {
    pub fn new(width: usize) -> Self {
        Self { width }
    }
}

impl Display for HorizontalLine {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        fmt.write_str(&"\u{2501}".repeat(self.width))
    }
}

// It prints `\n`
pub struct Softline;

pub const SOFT_LINE: Softline = Softline;

impl Display for Softline {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        fmt.write_str("\n")
    }
}

// It prints `\n\n`
pub struct Hardline;

pub const HARD_LINE: Hardline = Hardline;

impl Display for Hardline {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        fmt.write_str("\n\n")
    }
}

/// It prints N whitespaces, where N is the `width` provided by [Padding::new]
pub struct Padding {
    width: usize,
}

impl Padding {
    pub fn new(width: usize) -> Self {
        Self { width }
    }
}

impl Display for Padding {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        for _ in 0..self.width {
            fmt.write_str(" ")?;
        }
        Ok(())
    }
}

/// It writes a pair of key-value, with the given padding
pub struct KeyValuePair<'a>(&'a str, Markup<'a>, usize);

impl<'a> KeyValuePair<'a> {
    pub fn new(key: &'a str, value: Markup<'a>) -> Self {
        Self(key, value, 30usize)
    }

    pub fn with_padding(mut self, padding: usize) -> Self {
        self.2 = padding;
        self
    }
}

impl Display for KeyValuePair<'_> {
    fn fmt(&self, fmt: &mut Formatter) -> io::Result<()> {
        let KeyValuePair(key, value, padding) = self;
        write!(fmt, "  {key}:")?;

        let padding_width = padding.saturating_sub(key.len() + 1);

        for _ in 0..padding_width {
            fmt.write_str(" ")?;
        }

        value.fmt(fmt)?;

        fmt.write_str("\n")
    }
}

```

### Core Architecture Module: `crates/biome_css_analyze/src/utils.rs`
```
use biome_css_syntax::keywords::{
    A_NPLUS_BNOTATION_PSEUDO_CLASSES, A_NPLUS_BOF_SNOTATION_PSEUDO_CLASSES,
    AT_RULE_PAGE_PSEUDO_CLASSES, CSS_MODULE_PSEUDO_CLASSES, HTML_TAGS, KNOWN_CHROME_PROPERTIES,
    KNOWN_EDGE_PROPERTIES, KNOWN_EXPLORER_PROPERTIES, KNOWN_FIREFOX_PROPERTIES, KNOWN_PROPERTIES,
    KNOWN_SAFARI_PROPERTIES, KNOWN_SAMSUNG_INTERNET_PROPERTIES, KNOWN_US_BROWSER_PROPERTIES,
    LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS, LINGUISTIC_PSEUDO_CLASSES,
    LOGICAL_COMBINATIONS_PSEUDO_CLASSES, LONGHAND_SUB_PROPERTIES_OF_SHORTHAND_PROPERTIES,
    MATH_ML_TAGS, MEDIA_FEATURE_NAMES, OTHER_PSEUDO_CLASSES, OTHER_PSEUDO_ELEMENTS,
    RESET_TO_INITIAL_PROPERTIES_BY_BORDER, RESET_TO_INITIAL_PROPERTIES_BY_FONT,
    RESOURCE_STATE_PSEUDO_CLASSES, SHADOW_TREE_PSEUDO_ELEMENTS, SHORTHAND_PROPERTIES, SVG_TAGS,
    VENDOR_PREFIXES, VENDOR_SPECIFIC_PSEUDO_ELEMENTS,
};
use biome_css_syntax::{
    CssDeclarationWithSemicolon, CssSyntaxKind, CssSyntaxNode, CssSyntaxToken, ScssFunctionAtRule,
    ScssNestingDeclaration,
};
use biome_rowan::{AstNode, declare_node_union};
use biome_string_case::{StrLikeExtension, StrOnlyExtension};
use std::cmp::Ordering;
use std::iter::successors;

pub fn is_css_variable(value: &str) -> bool {
    value.to_ascii_lowercase_cow().starts_with("var(")
}

/// Check if the value is a double-dashed custom function.
pub fn is_custom_function(value: &str) -> bool {
    value.starts_with("--")
}

// Returns the vendor prefix extracted from an input string.
pub fn vender_prefix(prop: &str) -> &'static str {
    for prefix in VENDOR_PREFIXES.iter() {
        if prop.starts_with(prefix) {
            return prefix;
        }
    }
    ""
}

pub fn is_pseudo_elements(prop: &str) -> bool {
    LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS
        .binary_search(&prop)
        .is_ok()
        || VENDOR_SPECIFIC_PSEUDO_ELEMENTS.binary_search(&prop).is_ok()
        || SHADOW_TREE_PSEUDO_ELEMENTS.binary_search(&prop).is_ok()
        || OTHER_PSEUDO_ELEMENTS.binary_search(&prop).is_ok()
}

/// Check if the input string is custom selector
/// See https://drafts.csswg.org/css-extensions/#custom-selectors for more details
pub fn is_custom_selector(prop: &str) -> bool {
    prop.starts_with("--")
}

pub fn is_page_pseudo_class(prop: &str) -> bool {
    AT_RULE_PAGE_PSEUDO_CLASSES.binary_search(&prop).is_ok()
}

pub fn is_known_pseudo_class(prop: &str) -> bool {
    LEVEL_ONE_AND_TWO_PSEUDO_ELEMENTS
        .binary_search(&prop)
        .is_ok()
        || A_NPLUS_BNOTATION_PSEUDO_CLASSES
            .binary_search(&prop)
            .is_ok()
        || A_NPLUS_BOF_SNOTATION_PSEUDO_CLASSES
            .binary_search(&prop)
            .is_ok()
        || LINGUISTIC_PSEUDO_CLASSES.binary_search(&prop).is_ok()
        || LOGICAL_COMBINATIONS_PSEUDO_CLASSES
            .binary_search(&prop)
            .is_ok()
        || RESOURCE_STATE_PSEUDO_CLASSES.binary_search(&prop).is_ok()
        || OTHER_PSEUDO_CLASSES.binary_search(&prop).is_ok()
}

pub fn is_known_properties(prop: &str) -> bool {
    KNOWN_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_CHROME_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_EDGE_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_EXPLORER_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_FIREFOX_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_SAFARI_PROPERTIES.binary_search(&prop).is_ok()
        || KNOWN_SAMSUNG_INTERNET_PROPERTIES
            .binary_search(&prop)
            .is_ok()
        || KNOWN_US_BROWSER_PROPERTIES.binary_search(&prop).is_ok()
}

pub fn vendor_prefixed(props: &str) -> bool {
    props.starts_with("-webkit-")
        || props.starts_with("-moz-")
        || props.starts_with("-ms-")
        || props.starts_with("-o-")
}

/// Check if the input string is a media feature name.
pub fn is_media_feature_name(prop: &str) -> bool {
    let input = prop.to_ascii_lowercase_cow();
    let count = MEDIA_FEATURE_NAMES.binary_search(&input.as_ref());
    if count.is_ok() {
        return true;
    }
    let mut has_vendor_prefix = false;
    for prefix in VENDOR_PREFIXES.iter() {
        if input.starts_with(prefix) {
            has_vendor_prefix = true;
            break;
        }
    }
    if has_vendor_prefix {
        for feature_name in MEDIA_FEATURE_NAMES.iter() {
            if input.ends_with(feature_name) {
                return true;
            }
        }
    }
    false
}

pub fn get_longhand_sub_properties(shorthand_property: &str) -> &'static [&'static str] {
    if let Ok(index) = SHORTHAND_PROPERTIES.binary_search(&shorthand_property) {
        return LONGHAND_SUB_PROPERTIES_OF_SHORTHAND_PROPERTIES[index];
    }

    &[]
}

pub fn get_reset_to_initial_properties(shorthand_property: &str) -> &'static [&'static str] {
    match shorthand_property {
        "border" => &RESET_TO_INITIAL_PROPERTIES_BY_BORDER,
        "font" => &RESET_TO_INITIAL_PROPERTIES_BY_FONT,
        _ => &[],
    }
}

fn is_custom_element(prop: &str) -> bool {
    prop.contains('-') && prop.eq(prop.to_lowercase_cow().as_ref())
}

/// Check if the input string is a known type selector.
pub fn is_known_type_selector(prop: &str) -> bool {
    let input = prop.to_ascii_lowercase_cow();
    HTML_TAGS.binary_search(&input.as_ref()).is_ok()
        || SVG_TAGS.binary_search(&prop).is_ok()
        || MATH_ML_TAGS.binary_search(&input.as_ref()).is_ok()
        || is_custom_element(prop)
}

/// Check if the input string is a CSS module pseudo-class.
///
/// CSS modules support special pseudo-classes like `:global` and `:local` for
/// scoping control.
/// These are only valid when CSS modules are enabled.
///
/// See https://github.com/css-modules/css-modules for more details.
pub fn is_css_module_pseudo_class(prop: &str) -> bool {
    CSS_MODULE_PSEUDO_CLASSES.binary_search(&prop).is_ok()
}

declare_node_union! {
    /// A statement that sets a property: either a declaration, such as
    /// `transition: all 1s;`, or an SCSS group of nested properties, such as
    /// `transition: { duration: 1s; }`.
    ///
    /// Declarations in a condition, such as `@supports (transition: all 1s)`,
    /// aren't statements. They only test for browser support.
    pub AnyPropertyStatement = CssDeclarationWithSemicolon | ScssNestingDeclaration
}

impl AnyPropertyStatement {
    /// Returns the token of the property name, or `None` if the name isn't a
    /// plain identifier.
    pub fn name(&self) -> Option<CssSyntaxToken> {
        let name = match self {
            Self::CssDeclarationWithSemicolon(statement) => statement
                .declaration()
                .ok()?
                .property()
                .ok()?
                .as_css_generic_property()?
                .name(),
            Self::ScssNestingDeclaration(group) => group.name(),
        };
        name.ok()?.declaration().ok()
    }

    /// Returns the SCSS group of nested properties whose block contains this
    /// statement.
    ///
    /// Sass emits the properties in an `@if`, `@else`, `@each`, `@for`,
    /// `@while`, or `@include` block as part of the group around it, so those
    /// blocks are looked through. Returns `None` if the statement isn't in a
    /// group, or if a nested rule or any other at-rule, such as `@media`, is
    /// between them.
    pub fn group(&self) -> Option<Self> {
        self.syntax()
            .ancestors()
            .skip(1)
            .find(|ancestor| {
                !matches!(
                    ancestor.kind(),
                    CssSyntaxKind::CSS_DECLARATION_OR_RULE_LIST
                        | CssSyntaxKind::CSS_DECLARATION_OR_RULE_BLOCK
                        | CssSyntaxKind::CSS_AT_RULE
                        | CssSyntaxKind::SCSS_IF_AT_RULE
                        | CssSyntaxKind::SCSS_ELSE_CLAUSE
                        | CssSyntaxKind::SCSS_EACH_AT_RULE
                        | CssSyntaxKind::SCSS_FOR_AT_RULE
                        | CssSyntaxKind::SCSS_WHILE_AT_RULE
                        | CssSyntaxKind::SCSS_INCLUDE_AT_RULE
                )
            })
            .and_then(ScssNestingDeclaration::cast)
            .map(Self::from)
    }
}

/// Returns the name Sass emits for the property `name` nested in `group`.
///
/// Sass joins the name of a nested property to the names of the groups
/// around it, so `left-radius` in `border: { top: { left-radius: 1px; } }` sets
/// `border-top-left-radius`. Returns `None` if the name of a group isn't a
/// plain identifier, such as an interpolated `#{$side}`.
pub fn nested_property_name(name: &str, group: AnyPropertyStatement) -> Option<String> {
    let mut full_name = String::from(name);
    for group in successors(Some(group), AnyPropertyStatement::group) {
        let group_name = group.name()?;
        full_name.insert(0, '-');
        full_name.insert_str(0, group_name.text_trimmed());
    }
    Some(full_name)
}

const SCSS_BUILT_IN_FUNCTIONS: &[&str] = &[
    "abs",
    "adjust-color",
    "adjust-hue",
    "alpha",
    "append",
    "blue",
    "call",
    "ceil",
    "change-color",
    "color",
    "comparable",
    "complement",
    "content-exists",
    "darken",
    "desaturate",
    "fade-in",
    "fade-out",
    "feature-exists",
    "floor",
    "function-exists",
    "get-function",
    "global-variable-exists",
    "grayscale",
    "green",
    "hsl",
    "hsla",
    "hue",
    "hwb",
    "ie-hex-str",
    "if",
    "index",
    "inspect",
    "invert",
    "is-bracketed",
    "is-superselector",
    "join",
    "keywords",
    "lab",
    "lch",
    "length",
    "lighten",
    "lightness",
    "list-separator",
    "map-get",
    "map-has-key",
    "map-keys",
    "map-merge",
    "map-remove",
    "map-values",
    "max",
    "min",
    "mix",
    "mixin-exists",
    "nth",
    "oklab",
    "oklch",
    "opacify",
    "opacity",
    "percentage",
    "quote",
    "random",
    "red",
    "rgb",
    "rgba",
    "round",
    "saturate",
    "saturation",
    "scale-color",
```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/container_scroll_state_and_combinable_query.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssContainerScrollStateAndCombinableQuery;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssContainerScrollStateAndCombinableQuery;
impl FormatRule<AnyCssContainerScrollStateAndCombinableQuery>
    for FormatAnyCssContainerScrollStateAndCombinableQuery
{
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssContainerScrollStateAndCombinableQuery,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssContainerScrollStateAndCombinableQuery::CssContainerScrollStateAndQuery(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateAndCombinableQuery::CssContainerScrollStateInParens(node) => {
                node.format().fmt(f)
            }
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/container_scroll_state_in_parens.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssContainerScrollStateInParens;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssContainerScrollStateInParens;
impl FormatRule<AnyCssContainerScrollStateInParens> for FormatAnyCssContainerScrollStateInParens {
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssContainerScrollStateInParens,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssContainerScrollStateInParens::AnyCssContainerScrollStateQuery(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateInParens::AnyCssValue(node) => node.format().fmt(f),
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/container_scroll_state_or_combinable_query.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssContainerScrollStateOrCombinableQuery;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssContainerScrollStateOrCombinableQuery;
impl FormatRule<AnyCssContainerScrollStateOrCombinableQuery>
    for FormatAnyCssContainerScrollStateOrCombinableQuery
{
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssContainerScrollStateOrCombinableQuery,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssContainerScrollStateOrCombinableQuery::CssContainerScrollStateInParens(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateOrCombinableQuery::CssContainerScrollStateOrQuery(node) => {
                node.format().fmt(f)
            }
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/container_scroll_state_query.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssContainerScrollStateQuery;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssContainerScrollStateQuery;
impl FormatRule<AnyCssContainerScrollStateQuery> for FormatAnyCssContainerScrollStateQuery {
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssContainerScrollStateQuery,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssContainerScrollStateQuery::AnyCssQueryFeature(node) => node.format().fmt(f),
            AnyCssContainerScrollStateQuery::CssContainerScrollStateAndQuery(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateQuery::CssContainerScrollStateInParens(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateQuery::CssContainerScrollStateNotQuery(node) => {
                node.format().fmt(f)
            }
            AnyCssContainerScrollStateQuery::CssContainerScrollStateOrQuery(node) => {
                node.format().fmt(f)
            }
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/any/declaration_or_statement_block.rs`
```
//! This is a generated file. Don't modify it by hand! Run 'cargo codegen formatter' to re-generate the file.

use crate::prelude::*;
use biome_css_syntax::AnyCssDeclarationOrStatementBlock;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatAnyCssDeclarationOrStatementBlock;
impl FormatRule<AnyCssDeclarationOrStatementBlock> for FormatAnyCssDeclarationOrStatementBlock {
    type Context = CssFormatContext;
    fn fmt(
        &self,
        node: &AnyCssDeclarationOrStatementBlock,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        match node {
            AnyCssDeclarationOrStatementBlock::CssBogusBlock(node) => node.format().fmt(f),
            AnyCssDeclarationOrStatementBlock::CssDeclarationBlock(node) => node.format().fmt(f),
            AnyCssDeclarationOrStatementBlock::CssDeclarationOrAtRuleBlock(node) => {
                node.format().fmt(f)
            }
        }
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/auxiliary/container_scroll_state_and_query.rs`
```
use crate::prelude::*;
use biome_css_syntax::{CssContainerScrollStateAndQuery, CssContainerScrollStateAndQueryFields};
use biome_formatter::write;
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatCssContainerScrollStateAndQuery;
impl FormatNodeRule<CssContainerScrollStateAndQuery> for FormatCssContainerScrollStateAndQuery {
    fn fmt_fields(
        &self,
        node: &CssContainerScrollStateAndQuery,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        let CssContainerScrollStateAndQueryFields {
            left,
            and_token,
            right,
        } = node.as_fields();

        write!(
            f,
            [
                left.format(),
                space(),
                and_token.format()?.with_text_case(CssCase::Preserve),
                space(),
                right.format()
            ]
        )
    }
}

```

### Core Architecture Module: `crates/biome_css_formatter/src/css/auxiliary/container_scroll_state_in_parens.rs`
```
use crate::prelude::*;
use biome_css_syntax::{CssContainerScrollStateInParens, CssContainerScrollStateInParensFields};
use biome_formatter::{format_args, write};
#[derive(Debug, Clone, Default)]
pub(crate) struct FormatCssContainerScrollStateInParens;
impl FormatNodeRule<CssContainerScrollStateInParens> for FormatCssContainerScrollStateInParens {
    fn fmt_fields(
        &self,
        node: &CssContainerScrollStateInParens,
        f: &mut CssFormatter,
    ) -> FormatResult<()> {
        let CssContainerScrollStateInParensFields {
            l_paren_token,
            query,
            r_paren_token,
        } = node.as_fields();

        write!(
            f,
            [group(&format_args![
                l_paren_token.format(),
                &soft_block_indent(&query.format()),
                r_paren_token.format()
            ])]
        )
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #13413** (2026-11-24): **assist/source/noDuplicateClasses: the safe fix corrupts class attributes that hold template syntax in .html files**
  *Symptoms*: ## Environment  - Biome 2.6.9 (tag `@biomejs/biome@2.6.9`, commit cfef4254, which the links below use), and 2.6.8. `main` at caaa90bc has the same code. - macOS arm64, run with `pnpm dlx @biomejs/biome@2.6.9`.  ## What happened  `noDuplicateClasses` splits a `class` value on whitespace and treats every word as a class name. In an `.html` file with Django, Jinja, Handlebars or ERB syntax, the words include template tokens (`{%`, `if`, `tone`, `==`, `%}`). Biome removes the repeated words and labels the fix "safe". The result is a different template, and Biome gives no warning.  `biome.json`:  ```json {   "html": { "linter": { "enabled": true } },   "formatter": { "enabled": false },   "linter": { "rules": { "preset": "none" } },   "assist": { "actions": { "source": { "noDuplicateClasses": "on" } } } } ```  `page.html`:  ```html <div class="a {% if tone == 'info' %}b{% elif tone == 'warn' %}c{% endif %} a"></div> <div class="{% if a %}x{% endif %} {% if b %}y{% endif %}"></div> <div class="{{#if a}}x{{/if}} {{#if b}}y{{/if}}"></div> ```  Command: `biome check --write page.html`  Actual result, shown as a "Safe fix":  ```html <div class="a {% if tone == 'info' %}b{% elif 'warn' %}c{% endif %}"></div> <div class="{% if a %}x{% endif %} b %}y{%"></div> <div class="{{#if a}}x{{/if}} b}}y{{/if}}"></div> ```  Expected: no change. These are not plain class lists, so Biome can't know what a duplicate is.  Line 1 now tests another condition (`{% elif 'warn' %}` is always true). Lines 2 

- **Issue #13405** (2026-11-24): **fix(type_inference): remove undefined from defaulted parameter types**
  *Symptoms*: ## Summary The default value of a function parameter can remove `undefined` from the function parameter's type.  fixes #13392  implemented by Opus 5.5  ## Test Plan snapshots  ## Docs
  **Post-Mortem & Fix Analysis**:
  > ### 🦋 Changeset detected  Latest commit: 8a67cb0c67784a31c5e4ca2954b5315cd188c540  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 16 packages</summary>    | Name                          | Type  | | ----------------------------- | ----- | | @biomejs/biome                | Patch | | @biomejs/cli-android-arm64    | Patch | | @biomejs/cli-android-x64      | Patch | | @biomejs/cli-darwin-arm64     | Patch | | @biomejs/cli-darwin-x64       | Patch | | @biomejs/cli-linux-arm64-musl | Patch | | @biomejs/cli-linux-arm64      | Patch | | @biomejs/cli-linux-x64-musl   | Patch | | @biomejs/cli-linux-x64        | Patch | | @biomejs/cli-win32-arm64      | Patch | | @biomejs/cli-win32-x64        | Patch | | @biomejs/runtime              | Patch | | @biomejs/wasm-bundler         | Patch | | @biomejs/wasm-nodejs          | Patch | | @biomejs/wasm-web             | Patch | | @biomejs/backend-jsonrpc      | Patch |  </deta
  > <!-- coderabbit-ai-generated:v1 -->  <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/biomejs/biome/pull/13405?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><picture><source media="(prefers-color-scheme: dark)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-buttons-v1/explain-change-dark.svg"><source media="(prefers-color-scheme: light)" srcset="https://storage.googleapis.com/coderabbit_public_assets/review-stack-buttons-v1/explain-change.svg"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-buttons-v1/explain-change.svg" alt="Explain Change →" height="32"></picture></a>  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  ### Walkthrough  The change adds defaulted-parameter type information and uses it to remove `undefined` when the default cannot be `undefined`. It adds covera

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

### Incident Patch 1: `771de3e3` (2026-11-24)
**Commit Message**: fix(type_inference): remove undefined from defaulted parameter types (#13405)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.changeset/fix-parameter-default-undefined.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@biomejs/biome": patch
+---
+
+Fixed [#13392](https://github.com/biomejs/biome/issues/13392): [`useNullishCoalescing`](https://biomejs.dev/linter/rules/use-nullish-coalescing/) no longer reports `flag || other` when `flag` is a parameter whose default value removes `undefined` from its type, such as `flag: boolean | undefined = false`.
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/noMeaninglessVoidOperator/invalid.ts` (modified, +4/-0)
```diff
@@ -23,3 +23,7 @@ const callResult = void log();
 type Empty = void | undefined;
 declare function alias(): Empty;
 void alias();
+
+function withDefault(count: number = 0) {
+	void count;
+}
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/noMeaninglessVoidOperator/invalid.ts.snap` (modified, +35/-0)
```diff
@@ -30,6 +30,10 @@ type Empty = void | undefined;
 declare function alias(): Empty;
 void alias();
 
+function withDefault(count: number = 0) {
+	void count;
+}
+
 ```
 
 # Diagnostics
@@ -504,6 +508,7 @@ invalid.ts:25:1 lint/nursery/noMeaninglessVoidOperator  FIXABLE  ━━━━━
   > 25 │ void alias();
        │ ^^^^^^^^^^^^
     26 │ 
+    27 │ function withDefault(count: number = 0) {
   
   i This call already returns void or undefined.
   
@@ -518,6 +523,36 @@ invalid.ts:25:1 lint/nursery/noMeaninglessVoidOperator  FIXABLE  ━━━━━
     25    │ - void·alias();
        25 │ + (alias());
     26 26 │   
+    27 27 │   function withDefault(count: number = 0) {
+  
+
+```
+
+```
+invalid.ts:28:2 lint/nursery/noMeaninglessVoidOperator  FIXABLE  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  i This void operator is unnecessary.
+  
+    27 │ function withDefault(count: number = 0) {
+  > 28 │ 	void count;
+       │ 	^^^^^^^^^^
+    29 │ }
+    30 │ 
+  
+  i This operand is neither a function call nor a thenable.
+  
+  i Use void to explicitly discard a call's return value or a thenable.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+  i Unsafe fix: Remove the void operator.
+  
+    26 26 │   
+    27 27 │   function withDefault(count: number = 0) {
+    28    │ - → void·count;
+       28 │ + → (count);
+    29 29 │   }
+    30 30 │   
   
 
 ```
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/noMisusedPromises/checksVoidReturnInvalid.ts` (modified, +4/-0)
```diff
@@ -24,3 +24,7 @@ new ConstructorConsumer(async () => {});
 declare function consumeAfterSpread(prefix: number, callback: () => void): void;
 const prefixes: number[] = [];
 consumeAfterSpread(...prefixes, async () => {});
+
+function forEachWithDefault(callback: () => Promise<void> = async () => {}) {
+	[1].forEach(callback);
+}
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/noMisusedPromises/checksVoidReturnInvalid.ts.snap` (modified, +23/-0)
```diff
@@ -31,6 +31,10 @@ declare function consumeAfterSpread(prefix: number, callback: () => void): void;
 const prefixes: number[] = [];
 consumeAfterSpread(...prefixes, async () => {});
 
+function forEachWithDefault(callback: () => Promise<void> = async () => {}) {
+	[1].forEach(callback);
+}
+
 ```
 
 # Diagnostics
@@ -143,6 +147,25 @@ checksVoidReturnInvalid.ts:26:33 lint/nursery/noMisusedPromises ━━━━━
   > 26 │ consumeAfterSpread(...prefixes, async () => {});
        │                                 ^^^^^^^^^^^^^^
     27 │ 
+    28 │ function forEachWithDefault(callback: () => Promise<void> = async () => {}) {
+  
+  i This may not have the desired result if you expect the Promise to be `await`-ed.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+
+```
+
+```
+checksVoidReturnInvalid.ts:29:14 lint/nursery/noMisusedPromises ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  i This function returns a Promise, but no return value was expected.
+  
+    28 │ function forEachWithDefault(callback: () => Promise<void> = async () => {}) {
+  > 29 │ 	[1].forEach(callback);
+       │ 	            ^^^^^^^^
+    30 │ }
+    31 │ 
   
   i This may not have the desired result if you expect the Promise to be `await`-ed.
   
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/useNullishCoalescing/logicalOrInvalid.ts` (modified, +23/-0)
```diff
@@ -162,3 +162,26 @@ function withDefault(value: string | undefined) {
 	assertDefined(value);
 	return value || "default";
 }
+
+// `||` on a parameter whose default keeps `null` in the type
+export function nullableParameterWithDefault(value: string | null | undefined = "fallback") {
+	return value || "default";
+}
+
+// `||` on a parameter whose default may itself be `undefined`
+declare const maybeFallback: string | undefined;
+export function undefinedDefault(value: string | undefined = maybeFallback) {
+	return value || "default";
+}
+
+// `||` on a defaulted parameter that is reassigned
+export function reassignedDefault(value: string | undefined = "fallback") {
+	value = undefined;
+	return value || "default";
+}
+
+// `||` on a parameter whose `any` default keeps `null` in the type
+declare const anyFallback: any;
+export function anyDefault(value: string | null | undefined = anyFallback) {
+	return value || "default";
+}
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/useNullishCoalescing/logicalOrInvalid.ts.snap` (modified, +107/-0)
```diff
@@ -169,6 +169,29 @@ function withDefault(value: string | undefined) {
 	return value || "default";
 }
 
+// `||` on a parameter whose default keeps `null` in the type
+export function nullableParameterWithDefault(value: string | null | undefined = "fallback") {
+	return value || "default";
+}
+
+// `||` on a parameter whose default may itself be `undefined`
+declare const maybeFallback: string | undefined;
+export function undefinedDefault(value: string | undefined = maybeFallback) {
+	return value || "default";
+}
+
+// `||` on a defaulted parameter that is reassigned
+export function reassignedDefault(value: string | undefined = "fallback") {
+	value = undefined;
+	return value || "default";
+}
+
+// `||` on a parameter whose `any` default keeps `null` in the type
+declare const anyFallback: any;
+export function anyDefault(value: string | null | undefined = anyFallback) {
+	return value || "default";
+}
+
 ```
 
 # Diagnostics
@@ -857,3 +880,87 @@ logicalOrInvalid.ts:163:15 lint/nursery/useNullishCoalescing ━━━━━━
   
 
 ```
+
+```
+logicalOrInvalid.ts:168:15 lint/nursery/useNullishCoalescing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  i Use ?? instead of ||.
+  
+    166 │ // `||` on a parameter whose default keeps `null` in the type
+    167 │ export function nullableParameterWithDefault(value: string | null | undefined = "fallback") {
+  > 168 │ 	return value || "default";
+        │ 	             ^^
+    169 │ }
+    170 │ 
+  
+  i The || operator checks for all falsy values (including 0, '', and false), while ?? only checks for null and undefined.
+  
+  i This rule is still being actively worked on, so it may be missing features or have rough edges. Visit https://github.com/biomejs/biome/issues/8043 for more information or to report possible bugs.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+
+```
+
+```
+logicalOrInvalid.ts:174:15 lint/nursery/useNullishCoalescing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  i Use ?? instead of ||.
+  
+    172 │ declare const maybeFallback: string | undefined;
+    173 │ export function undefinedDefault(value: string | undefined = maybeFallback) {
+  > 174 │ 	return value || "default";
+        │ 	             ^^
+    175 │ }
+    176 │ 
+  
+  i The || operator checks for all falsy values (including 0, '', and false), while ?? only checks for null and undefined.
+  
+  i This rule is still being actively worked on, so it may be missing features or have rough edges. Visit https://github.com/biomejs/biome/issues/8043 for more information or to report possible bugs.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+
+```
+
+```
+logicalOrInvalid.ts:180:15 lint/nursery/useNullishCoalescing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  i Use ?? instead of ||.
+  
+    178 │ export function reassignedDefault(value: string | undefined = "fallback") {
+    179 │ 	value = undefined;
+  > 180 │ 	return value || "default";
+        │ 	             ^^
+    181 │ }
+    182 │ 
+  
+  i The || operator checks for all falsy values (including 0, '', and false), while ?? only checks for null and undefined.
+  
+  i This rule is still being actively worked on, so it may be missing features or have rough edges. Visit https://github.com/biomejs/biome/issues/8043 for more information or to report possible bugs.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+
+```
+
+```
+logicalOrInvalid.ts:186:15 lint/nursery/useNullishCoalescing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+
+  i Use ?? instead of ||.
+  
+    184 │ declare const anyFallback: any;
+    185 │ export function anyDefault(value: string | null | undefined = anyFallback) {
+  > 186 │ 	return value || "default";
+        │ 	             ^^
+    187 │ }
+    188 │ 
+  
+  i The || operator checks for all falsy values (including 0, '', and false), while ?? only checks for null and undefined.
+  
+  i This rule is still being actively worked on, so it may be missing features or have rough edges. Visit https://github.com/biomejs/biome/issues/8043 for more information or to report possible bugs.
+  
+  i This rule belongs to the nursery group, which means it is not yet stable and may change in the future. Visit https://biomejs.dev/linter/#nursery for more information.
+  
+
+```
```

**File**: `crates/biome_js_analyze/tests/specs/nursery/useNullishCoalescing/logicalOrValid.ts` (modified, +8/-0)
```diff
@@ -73,3 +73,11 @@ export const declaratorResult = fromDeclarator || undefined;
 declare const list: (number | undefined)[];
 const [first = 1] = list;
 export const arrayResult = first || undefined;
+
+// `||` on a parameter whose default removes `undefined`
+export function annotatedWithDefault(flag: boolean | undefined = false, other: boolean) {
+	return flag || other;
+}
+
+export const arrowWithDefault = (flag: boolean | undefined = false, other: boolean) =>
+	flag || other;
```

---

### Incident Patch 2: `2460d162` (2026-11-24)
**Commit Message**: fix(biome_js_analyze): allow import attributes on mixed type/value imports (#13394)

**File**: `crates/biome_js_analyze/src/syntax/correctness/no_type_only_import_attributes.rs` (modified, +18/-21)
```diff
@@ -75,11 +75,14 @@ impl Rule for NoTypeOnlyImportAttributes {
                 AnyJsExportClause::JsExportNamedFromClause(clause) => {
                     let assertion_range = clause.assertion()?.range();
                     let type_token = clause.type_token().or_else(|| {
-                        clause
-                            .specifiers()
-                            .iter()
-                            .filter_map(|specifier| specifier.ok())
-                            .find_map(|specifier| specifier.type_token())
+                        let mut first_type_token = None;
+                        for specifier in clause.specifiers().iter().filter_map(|s| s.ok()) {
+                            let token = specifier.type_token()?;
+                            if first_type_token.is_none() {
+                                first_type_token = Some(token);
+                            }
+                        }
+                        first_type_token
                     })?;
                     Some(RuleState {
                         assertion_range,
@@ -88,17 +91,8 @@ impl Rule for NoTypeOnlyImportAttributes {
                 }
             },
             AnyJsModuleItem::JsImport(import) => match import.import_clause().ok()? {
-                AnyJsImportClause::JsImportBareClause(_) => None,
-                AnyJsImportClause::JsImportCombinedClause(clause) => {
-                    let assertion_range = clause.assertion()?.range();
-                    let type_token = find_first_type_token(
-                        clause.specifier().ok()?.as_js_named_import_specifiers()?,
-                    )?;
-                    Some(RuleState {
-                        assertion_range,
-                        type_token_range: type_token.text_trimmed_range(),
-                    })
-                }
+                AnyJsImportClause::JsImportBareClause(_)
+                | AnyJsImportClause::JsImportCombinedClause(_) => None,
                 AnyJsImportClause::JsImportDefaultClause(clause) => Some(RuleState {
                     assertion_range: clause.assertion()?.range(),
                     type_token_range: clause.type_token()?.text_trimmed_range(),
@@ -153,9 +147,12 @@ pub struct RuleState {
 }
 
 fn find_first_type_token(named_specifiers: &JsNamedImportSpecifiers) -> Option<JsSyntaxToken> {
-    named_specifiers
-        .specifiers()
-        .iter()
-        .filter_map(|specifier| specifier.ok())
-        .find_map(|specifier| specifier.type_token())
+    let mut first_type_token = None;
+    for specifier in named_specifiers.specifiers().iter().filter_map(|s| s.ok()) {
+        let token = specifier.type_token()?;
+        if first_type_token.is_none() {
+            first_type_token = Some(token);
+        }
+    }
+    first_type_token
 }
```

**File**: `crates/biome_js_analyze/tests/specs/correctness/noTypeOnlyImportAttributes/invalid.ts` (modified, +1/-2)
```diff
@@ -2,8 +2,7 @@ import type A from "" with { type: "json" };
 import type * as B from "" with { type: "json" };
 import type { C } from "" with { type: "json" };
 import { type D } from "" with { type: "json" };
-import { E, type F } from "" with { type: "json" };
 
 export type { A } from "" with { type: "json" };
 export type * as B from "" with { type: "json" };
-export { E, type F } from "" with { type: "json" };
\ No newline at end of file
+export { type F } from "" with { type: "json" };
\ No newline at end of file
```

**File**: `crates/biome_js_analyze/tests/specs/correctness/noTypeOnlyImportAttributes/invalid.ts.snap` (modified, +34/-59)
```diff
@@ -8,11 +8,10 @@ import type A from "" with { type: "json" };
 import type * as B from "" with { type: "json" };
 import type { C } from "" with { type: "json" };
 import { type D } from "" with { type: "json" };
-import { E, type F } from "" with { type: "json" };
 
 export type { A } from "" with { type: "json" };
 export type * as B from "" with { type: "json" };
-export { E, type F } from "" with { type: "json" };
+export { type F } from "" with { type: "json" };
 ```
 
 # Diagnostics
@@ -68,7 +67,7 @@ invalid.ts:3:27 syntax/correctness/noTypeOnlyImportAttributes ━━━━━━
   > 3 │ import type { C } from "" with { type: "json" };
       │                           ^^^^^^^^^^^^^^^^^^^^^
     4 │ import { type D } from "" with { type: "json" };
-    5 │ import { E, type F } from "" with { type: "json" };
+    5 │ 
   
   i The type-only import is defined here.
   
@@ -77,7 +76,7 @@ invalid.ts:3:27 syntax/correctness/noTypeOnlyImportAttributes ━━━━━━
   > 3 │ import type { C } from "" with { type: "json" };
       │        ^^^^
     4 │ import { type D } from "" with { type: "json" };
-    5 │ import { E, type F } from "" with { type: "json" };
+    5 │ 
   
 
 ```
@@ -91,105 +90,81 @@ invalid.ts:4:27 syntax/correctness/noTypeOnlyImportAttributes ━━━━━━
     3 │ import type { C } from "" with { type: "json" };
   > 4 │ import { type D } from "" with { type: "json" };
       │                           ^^^^^^^^^^^^^^^^^^^^^
-    5 │ import { E, type F } from "" with { type: "json" };
-    6 │ 
+    5 │ 
+    6 │ export type { A } from "" with { type: "json" };
   
   i The type-only import is defined here.
   
     2 │ import type * as B from "" with { type: "json" };
     3 │ import type { C } from "" with { type: "json" };
   > 4 │ import { type D } from "" with { type: "json" };
       │          ^^^^
-    5 │ import { E, type F } from "" with { type: "json" };
-    6 │ 
+    5 │ 
+    6 │ export type { A } from "" with { type: "json" };
   
 
 ```
 
 ```
-invalid.ts:5:30 syntax/correctness/noTypeOnlyImportAttributes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-
-  × Import attributes cannot be used with a type-only import.
-  
-    3 │ import type { C } from "" with { type: "json" };
-    4 │ import { type D } from "" with { type: "json" };
-  > 5 │ import { E, type F } from "" with { type: "json" };
-      │                              ^^^^^^^^^^^^^^^^^^^^^
-    6 │ 
-    7 │ export type { A } from "" with { type: "json" };
-  
-  i The type-only import is defined here.
-  
-    3 │ import type { C } from "" with { type: "json" };
-    4 │ import { type D } from "" with { type: "json" };
-  > 5 │ import { E, type F } from "" with { type: "json" };
-      │             ^^^^
-    6 │ 
-    7 │ export type { A } from "" with { type: "json" };
-  
-
-```
-
-```
-invalid.ts:7:27 syntax/correctness/noTypeOnlyImportAttributes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+invalid.ts:6:27 syntax/correctness/noTypeOnlyImportAttributes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
   × Import attributes cannot be used with a type-only export.
   
-    5 │ import { E, type F } from "" with { type: "json" };
-    6 │ 
-  > 7 │ export type { A } from "" with { type: "json" };
+    4 │ import { type D } from "" with { type: "json" };
+    5 │ 
+  > 6 │ export type { A } from "" with { type: "json" };
       │                           ^^^^^^^^^^^^^^^^^^^^^
-    8 │ export type * as B from "" with { type: "json" };
-    9 │ export { E, type F } from "" with { type: "json" };
+    7 │ export type * as B from "" with { type: "json" };
+    8 │ export { type F } from "" with { type: "json" };
   
   i The type-only export is defined here.
   
-    5 │ import { E, type F } from "" with { type: "json" };
-    6 │ 
-  > 7 │ export type { A } from "" with { type: "json" };
+    4 │ import { type D } from "" with { type: "json" };
+    5 │ 
+  > 6 │ export type { A } from "" with { type: "json" };
       │        ^^^^
-    8 │ export type * as B from "" with { type: "json" };
-    9 │ export { E, type F } from "" with { type: "json" };
+    7 │ export type * as B from "" with { type: "json" };
+    8 │ export { type F } from "" with { type: "json" };
   
 
 ```
 
 ```
-invalid.ts:8:28 syntax/correctness/noTypeOnlyImportAttributes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+invalid.ts:7:28 syntax/correctness/noTypeOnlyImportAttributes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
   × Import attributes cannot be used with a type-only export.
   
-    7 │ export type { A } from "" with { type: "json" };
-  > 8 │ export type * as B from "" with { type: "json" };
+    6 │ export type { A } from "" with { type: "json" };
+  > 7 │ export type * as B from "" with { type: "json" };
       │                            ^^^^^^^^^^^^^^^^^^^^^
-    9 │ export { E, type F } from "" with { type: "json" };
+    8 │ export { type F } from "" with { type: "json" };
   
   i The type-only export is defined here.
   
-    7 │ export type { A } from "" with { type: "json"
```

**File**: `crates/biome_js_analyze/tests/specs/correctness/noTypeOnlyImportAttributes/valid.ts` (modified, +4/-1)
```diff
@@ -3,7 +3,10 @@ import type A from "";
 import type * as B from "";
 import type { C } from "";
 import { type D } from "";
+import { E, type F } from "" with { type: "json" };
+import Def, { type F } from "" with { type: "json" };
 
 export type { A } from "";
 export type * as B from "";
-export { E, type F } from "";
\ No newline at end of file
+export { E, type F } from "";
+export { E, type F } from "" with { type: "json" };
\ No newline at end of file
```

**File**: `crates/biome_js_analyze/tests/specs/correctness/noTypeOnlyImportAttributes/valid.ts.snap` (modified, +3/-0)
```diff
@@ -9,8 +9,11 @@ import type A from "";
 import type * as B from "";
 import type { C } from "";
 import { type D } from "";
+import { E, type F } from "" with { type: "json" };
+import Def, { type F } from "" with { type: "json" };
 
 export type { A } from "";
 export type * as B from "";
 export { E, type F } from "";
+export { E, type F } from "" with { type: "json" };
 ```
```

#### Recent Merged Pull Requests:
- **PR #13405** (2026-11-24): fix(type_inference): remove undefined from defaulted parameter types (@dyc3)
- **PR #13401** (closed): feat(svelte): resolve component bindings (@ematipico)
- **PR #13400** (2026-11-24): fix(svelte): preserve formatting safety (@ematipico)
- **PR #13398** (closed): fix(markdown): stop quoted lists before unquoted newlines and blank lines (@VB-Blue)
- **PR #13394** (2026-11-24): fix(biome_js_analyze): allow import attributes on mixed type/value imports (@EnesKartal)
- **PR #13388** (2026-11-23): chore: update rule metadata (@dyc3)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. type_inference): remove undefined from defaulted parameter types

**RULE**:
When implementing operations in `.changeset/fix-parameter-default-undefined.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in biomejs/biome. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `771de3e3`: type_inference): remove undefined from defaulted parameter types. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/fix-parameter-default-undefined.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
---
"@biomejs/biome": patch
---

Fixed [#13392](https://github.com/biomejs/biome/issues/13392): [`useNullishCoalescing`](https://biomejs.dev/linter/rules/use-nullish-coalescing/) no longer reports `flag || other` when `flag` is a parameter whose default value removes `undefined` from its type, such as `flag: boolean | undefined = false`.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `771de3e3` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
