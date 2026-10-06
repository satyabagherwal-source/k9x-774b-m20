# Forensic Learning Record (Deep Inspection): jundizhou/easy-stock

> **Canonical Artifact**: `07_PROJECT_LEARNING/jundizhou-easy-stock-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jundizhou/easy-stock](https://github.com/jundizhou/easy-stock))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:52:57.873Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jundizhou/easy-stock`
- **Description**: A股行情分析与AI智能投研智能体：股票分析、量化交易分析、盘后复盘桌面工作台——easy stock
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1304 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/internal/stockanalysis/engine.go`
```
package stockanalysis

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"easy-stock/backend/internal/foundation"
)

func Analyze(input Input) (Analysis, error) {
	lines := normalizeKLines(input.KLines)
	if len(lines) == 0 {
		return Analysis{}, fmt.Errorf("个股AI分析至少需要1个有效交易日K线，当前只有0个")
	}
	if len(lines) < 20 {
		return analyzeNewListing(input, lines), nil
	}

	quote := input.Quote
	last := lines[len(lines)-1]
	if strings.TrimSpace(quote.Symbol) == "" {
		quote.Symbol = input.Symbol
	}
	if quote.Price <= 0 {
		quote.Price = last.Close
	}
	if quote.ChangePercent == 0 && len(lines) >= 2 && lines[len(lines)-2].Close > 0 {
		quote.ChangePercent = percentChange(lines[len(lines)-2].Close, last.Close)
	}
	name := strings.TrimSpace(quote.Name)
	if name == "" {
		name = input.Symbol
		quote.Name = name
	}

	trend, chart := analyzeTrend(lines)
	currentPrice := firstPositive(quote.Price, trend.LatestClose)
	shortTerm := analyzeShortTerm(input.Symbol, lines, input.LimitUps)
	theme := analyzeTheme(input.Symbol, shortTerm, input.CachedThemes, input.Concepts, input.Industry, input.Themes, input.LimitUps, input.Business, input.BusinessDetail, input.BusinessSource)
	theme = enrichTheme(input, shortTerm, theme)
	market := marketContext(input)
	shortTermQuantitative := buildShortTermQuantitativePlan(input, shortTerm, theme, market)
	profile := classifyProfile(trend, shortTerm, theme, market)
	fundamentalValue := analyzeFundamentals(input.Fundamentals)
	fundamental := &fundamentalValue
	researchValue := analyzeResearch(input.Reports)
	research := &researchValue
	stockNewsValue, themeNewsValue := analyzeRecentNews(input, theme)
	stockNews := &stockNewsValue
	themeNews := &themeNewsValue
	risks := buildRisks(profile, trend, shortTerm, theme, market)
	timeframes := analyzeTimeframes(lines)
	relative := analyzeRelativeStrength(input, lines)
	riskControl := buildRiskControl(profile, trend, shortTerm, market)
	action := buildActionPlan(profile, trend, shortTerm, theme, market, relative, riskControl, shortTermQuantitative, currentPrice)
	if action.DecisionMode != "short_term" {
		riskControl = alignRiskControlWithActionPlan(riskControl, action)
	}
	riskControl = finalizeRiskControl(riskControl, profile, trend, shortTerm, market)
	nextDay := buildNextDayPlan(lines, profile, trend, shortTerm, theme, market, relative, riskControl)
	signals := buildSignals(trend, shortTerm, theme, market, relative, riskControl, timeframes, fundamental, research)
	scorecard := buildScorecard(profile, signals)
	conclusion := buildConclusion(name, profile, trend, shortTerm, action, risks)
	evidence := buildEvidence(input, profile, trend, shortTerm, theme, market, relative, riskControl, lines, fundamental, research, stockNews, themeNews)
	quality := buildDataQuality(input, profile, lines, shortTerm, theme, market, relative, fundamental, research, stockNews, themeNews)

	return Analysis{
		Symbol:                input.Symbol,
		Name:                  name,
		GeneratedAt:           time.Now(),
		Quote:                 quote,
		Profile:               profile,
		Conclusion:            conclusion,
		Trend:                 trend,
		ShortTerm:             shortTerm,
		Theme:                 theme,
		Fundamental:           fundamental,
		Research:              research,
		StockNews:             stockNews,
		ThemeNews:             themeNews,
		Market:                market,
		Scorecard:             scorecard,
		Timeframes:            timeframes,
		Relative:              relative,
		Signals:               signals,
		NextDay:               nextDay,
		RiskControl:           riskControl,
		ActionPlan:            action,
		Risks:                 risks,
		Evidence:              evidence,
		DataQuality:           quality,
		Chart:                 chart,
		AI:                    AISynthesisStatus{Status: "rules", Message: "当前结论由本地结构化分析引擎生成"},
		shortTermQuantitative: &shortTermQuantitative,
		dailyBars:             compactDailyBars(lines, 120),
	}, nil
}

func analyzeFundamentals(item *foundation.StockFundamentals) FundamentalAnalysis {
	if item == nil || strings.TrimSpace(item.ReportDate) == "" {
		return FundamentalAnalysis{Quality: "数据不足", Sustainability: "数据不足", Summary: "尚未取得最新F10财务数据"}
	}
	// Keep the non-zero fallback for older providers/fixtures, while allowing a
	// provider to explicitly mark a legitimate zero value as available.
	hasDeductedProfit := item.DeductedNetProfitAvailable || item.DeductedNetProfit != 0 || item.DeductedNetProfitYearOverYear != 0
	recurringProfit := item.NetProfit
	recurringGrowth := item.NetProfitYearOverYear
	nonRecurringProfit := 0.0
	nonRecurringRatio := 0.0
	sustainability := "待确认"
	sustainabilityFlags := make([]string, 0, 3)
	if hasDeductedProfit {
		recurringProfit = item.DeductedNetProfit
		recurringGrowth = item.DeductedNetProfitYearOverYear
		nonRecurringProfit = item.NetProfit - item.DeductedNetProfit
		if math.Abs(item.NetProfit) > 1e-9 {
			nonRecurringRatio = math.Abs(nonRecurringProfit) / math.Abs(item.NetProfit) * 100
		}
		sustainability = "较好"
		if nonRecurringProfit > 0 && nonRecurringRatio >= 50 {
			sustainability = "较差"
			sustainabilityFlags = append(sustainabilityFlags, "净利润主要依赖非经常性损益")
		} else if nonRecurringProfit > 0 && nonRecurringRatio >= 30 {
			sustainability = "一般"
			sustainabilityFlags = append(sustainabilityFlags, "非经常性损益占比较高")
		} else if nonRecurringProfit > 0 && nonRecurringRatio >= 15 {
			sustainability = "一般"
			sustainabilityFlags = append(sustainabilityFlags, "存在一定一次性收益影响")
		}
		if recurringProfit <= 0 && item.NetProfit > 0 {
			sustainability = "较差"
			sustainabilityFlags = append(sustainabilityFlags, "剔除非经常性损益后归母利润为负")
		}
	} else {
		sustainabilityFlags = append(sustainabilityFlags, "缺少扣非净利润，持续性无法完全核验")
	}
	score := 50.0
	score += clamp(item.RevenueYearOverYear/8, -15, 15)
	score += clamp(recurringGrowth/6, -20, 20)
	if hasDeductedProfit {
		switch {
		case recurringProfit <= 0 && item.NetProfit > 0:
			score -= 20
		case nonRecurringProfit > 0 && nonRecurringRatio >= 50:
			score -= 18
		case nonRecurringProfit > 0 && nonRecurringRatio >= 30:
			score -= 12
		case nonRecurringProfit > 0 && nonRecurringRatio >= 15:
			score -= 6
		}
	}
	if item.ROE >= 15 {
		score += 12
	} else if item.ROE >= 8 {
		score += 6
	} else if item.ROE > 0 && item.ROE < 3 {
		score -= 6
	} else if item.ROE < 0 {
		score -= 15
	}
	if item.GrossMargin >= 35 {
		score += 8
	} else if item.GrossMargin > 0 && item.GrossMargin < 12 {
		score -= 8
	}
	if item.DebtRatio >= 75 {
		score -= 12
	} else if item.DebtRatio > 0 && item.DebtRatio <= 45 {
		score += 5
	}
	if item.OperatingCashFlowPerShare > 0 {
		score += 5
	} else if item.OperatingCashFlowPerShare < 0 {
		score -= 5
	}
	finalScore := int(math.Round(clamp(score, 0, 100)))
	quality := "中性"
	if finalScore >= 72 {
		quality = "较好"
	} else if finalScore >= 58 {
		quality = "稳健"
	} else if finalScore < 35 {
		quality = "承压"
	} else if finalScore < 48 {
		quality = "偏弱"
	}
	summary := fmt.Sprintf("%s：营收同比%+.1f%%，归母净利同比%+.1f%%，持续性口径同比%+.1f%%，ROE %.1f%%，毛利率%.1f%%，负债率%.1f%%", firstNonEmpty(item.ReportName, item.ReportDate), item.RevenueYearOverYear, item.NetProfitYearOverYear, recurringGrowth, item.ROE, item.GrossMargin, item.DebtRatio)
	if hasDeductedProfit {
		summary += fmt.Sprintf("；非经常性损益占归母净利%.1f%%，扣非净利润%.2f", nonRecurringRatio, recurringProfit)
	} else {
		summary += "；未取得扣非净利润，未将利润增长完全视为可持续增长"
	}
	return FundamentalAnalysis{
		Available: true, Score: finalScore, Quality: quality, ReportDate: item.ReportDate, ReportName: item.ReportName,
		Revenue: item.Revenue, RevenueYearOverYear: item.RevenueYearOverYear, NetProfit: item.NetProfit,
		NetProfitYearOverYear: item.NetProfitYearOverYear, RecurringNetProfitAvailable: hasDeductedProfit, RecurringNetProfit: recurringProfit, RecurringNetProfitYearOverYear: recurringGrowth,
		NonRecurringProfit: nonRecurringProfit, NonRecurringProfitRatio: round2(nonRecurringRatio), Sustainability: sustainability, SustainabilityFlags: uniqueStrings(sustainabilityFlags, 4), EPS: item.EPS, ROE: item.ROE, GrossMargin: item.GrossMargin,
		DebtRatio: item.DebtRatio, OperatingCashFlowPerShare: item.OperatingCashFlowPerShare,
		Summary: summary, Source: item.Meta.Source,
	}
}

func analyzeResearch(items []foundation.MarketResearchItem) ResearchAnalysis {
	if len(items) == 0 {
		return ResearchAnalysis{Coverage: "暂无覆盖", Summary: "近45日未取得该股机构研报", Reports: []foundation.MarketResearchItem{}}
	}
	organizations := map[string]bool{}
	ratingChanges := []string{}
	positiveRatings := 0
	latestRating := ""
	for index, item := range items {
		if value := strings.TrimSpace(item.Organization); value != "" {
			organizations[value] = true
		}
		if index == 0 {
			latestRating = strings.TrimSpace(item.Rating)
		}
		if ratingIsPositive(item.Rating) {
			positiveRatings++
		}
		if value := strings.TrimSpace(item.RatingChange); value != "" {
			ratingChanges = append(ratingChanges, value)
		}
	}
	score := 45 + min(len(items), 8)*3 + min(len(organizations), 5)*2
	if len(items) > 0 {
		score += int(math.Round(float64(positiveRatings) / float64(len(items)) * 20))
	}
	score = int(clamp(float64(score), 0, 100))
	coverage := "有限"
	if len(items) >= 5 || len(organizations) >= 3 {
		coverage = "较充分"
	} else if len(items) >= 2 {
		coverage = "一般"
	}
	summary := fmt.Sprintf("近45日收录%d篇个股研报，覆盖%d家机构", len(items), len(organizations))
	if latestRating != "" {
		summary += "，最新评级" + latestRating
	}
	return ResearchAnalysis{Available: true, Score: score, Coverage: coverage, ReportCount: len(items), OrganizationCount: len(organizations), LatestRating: latestRating, RatingChanges: uniqueStrings(ratingChanges, 5), Summary: summary, Reports: items[:min(len(items), 6)]}
}

func ratingIsPositive(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	for _, keyword := range []string{"买入", "增持", "强烈推荐", "推荐", "outperform", "buy"} {
		if strings.Contains(value, keyword) {
			return true
		}
	}
	return false
}

func analyzeTrend(lines []foundation.KLine) (TrendAnalysis, []Tre
```

### Core Architecture Module: `backend/internal/strategy/inflection/engine.go`
```
package inflection

import (
	"fmt"
	"math"
	"sort"
	"time"
)

type Engine struct {
	config Config
}

func NewEngine(config Config) *Engine {
	return &Engine{config: config}
}

func (e *Engine) Evaluate(request EvaluationRequest) (Evaluation, error) {
	if err := validateRequest(request); err != nil {
		return Evaluation{}, err
	}

	marketStress, stressFactors := e.scoreMarketStress(request.Market)
	environmentTurn, environmentFactors := e.scoreEnvironmentTurn(request.Market)
	candidates := make([]CandidateEvaluation, 0, len(request.Candidates))
	for _, candidate := range request.Candidates {
		candidates = append(candidates, e.evaluateCandidate(candidate))
	}

	anchors := []AnchorSelection{
		e.selectAnchor(AnchorOldProfit, candidates),
		e.selectAnchor(AnchorOldNegative, candidates),
		e.selectAnchor(AnchorNewCarrier, candidates),
	}
	anchorByKind := make(map[AnchorKind]AnchorSelection, len(anchors))
	for _, anchor := range anchors {
		anchorByKind[anchor.Kind] = anchor
	}

	big := e.evaluateBig(
		request.Market.Scope,
		marketStress,
		environmentTurn,
		stressFactors,
		environmentFactors,
		anchorByKind,
	)
	small := e.evaluateSmall(request.Market.Scope, marketStress, environmentTurn, anchorByKind)
	big.Kinds = classifyTurningPoints(request.Market, big, marketStress, environmentTurn)
	small.Kinds = classifyTurningPoints(request.Market, small, marketStress, environmentTurn)

	primary := InflectionNone
	if big.Status == StatusConfirmed {
		primary = InflectionBig
	} else if small.Status == StatusConfirmed {
		primary = InflectionSmall
	} else if big.Status == StatusCandidate {
		primary = InflectionBig
	} else if small.Status == StatusCandidate {
		primary = InflectionSmall
	}

	warnings := make([]string, 0, 4)
	if anchorByKind[AnchorNewCarrier].Selected == nil {
		warnings = append(warnings, "尚未提供新承接物，无法确认拐点")
	} else if !anchorByKind[AnchorNewCarrier].Clear {
		warnings = append(warnings, "新承接物辨识度不足或龙一不清晰")
	}
	if anchorByKind[AnchorOldProfit].Selected == nil && anchorByKind[AnchorOldNegative].Selected == nil {
		warnings = append(warnings, "尚未提供旧赚钱效应锚或旧负反馈锚")
	}
	warnings = append(warnings, "V1为快照规则引擎，信号仍需通过历史回放、T+1和真实成交约束验证")

	evaluatedAt := request.Market.Time
	if evaluatedAt.IsZero() {
		evaluatedAt = time.Now()
	}
	return Evaluation{
		EvaluatedAt:          evaluatedAt,
		MarketStressScore:    round1(marketStress),
		EnvironmentTurnScore: round1(environmentTurn),
		Candidates:           candidates,
		Anchors:              anchors,
		Big:                  big,
		Small:                small,
		PrimarySignal:        primary,
		Warnings:             warnings,
	}, nil
}

func classifyTurningPoints(m MarketSnapshot, signal SignalEvaluation, stress, turn float64) []TurningPointKind {
	var kinds []TurningPointKind
	if signal.Status == StatusNone {
		return kinds
	}
	if signal.Type == InflectionBig {
		kinds = append(kinds, TurningPointMarketExhaustion)
	}
	if turn >= 55 && stress >= 55 {
		kinds = append(kinds, TurningPointSentimentRepair)
	}
	if signal.Setup == SmallSetupHighLowSwitch {
		kinds = append(kinds, TurningPointHighLowSwitch, TurningPointSectorRotation)
	}
	if signal.Setup == SmallSetupIndividualReversal {
		kinds = append(kinds, TurningPointIndividualReverse)
	}
	if m.Scope == ScopeSector {
		kinds = append(kinds, TurningPointSectorRotation)
	}
	if m.Scope == ScopeStock {
		kinds = append(kinds, TurningPointTrendReverse)
	}
	if m.Scope == ScopeMarket {
		kinds = append(kinds, TurningPointIndexReverse)
	}
	if signal.NewCarrierSymbol != "" {
		kinds = append(kinds, TurningPointExpectationGap)
	}
	return uniqueTurningPoints(kinds)
}

func uniqueTurningPoints(in []TurningPointKind) []TurningPointKind {
	seen := make(map[TurningPointKind]bool, len(in))
	out := make([]TurningPointKind, 0, len(in))
	for _, k := range in {
		if !seen[k] {
			seen[k] = true
			out = append(out, k)
		}
	}
	return out
}

func validateRequest(request EvaluationRequest) error {
	seen := map[string]AnchorKind{}
	for index, candidate := range request.Candidates {
		if candidate.Symbol == "" {
			return fmt.Errorf("candidates[%d].symbol is required", index)
		}
		switch candidate.Kind {
		case AnchorOldProfit, AnchorOldNegative, AnchorNewCarrier:
		default:
			return fmt.Errorf("candidates[%d].kind %q is invalid", index, candidate.Kind)
		}
		key := string(candidate.Kind) + ":" + candidate.Symbol
		if _, exists := seen[key]; exists {
			return fmt.Errorf("duplicate candidate %s for kind %s", candidate.Symbol, candidate.Kind)
		}
		seen[key] = candidate.Kind
	}
	return nil
}

func (e *Engine) evaluateCandidate(candidate CandidateSnapshot) CandidateEvaluation {
	recognition := weighted([]weightedValue{
		{candidate.Recognition.Height, e.config.RecognitionWeights.Height},
		{candidate.Recognition.Attention, e.config.RecognitionWeights.Attention},
		{candidate.Recognition.Persistence, e.config.RecognitionWeights.Persistence},
		{candidate.Recognition.Influence, e.config.RecognitionWeights.Influence},
		{candidate.Recognition.Resilience, e.config.RecognitionWeights.Resilience},
	})
	relativeReturn := candidate.ChangePercent - 0.5*candidate.ScopeChangePercent - 0.5*candidate.MarketChangePercent

	weakRelative := negativeScale(relativeReturn, 4)
	weakVWAP := negativeScale(candidate.VWAPDistancePercent, 3)
	weakBoard := 0.0
	if candidate.BoardBroken {
		weakBoard = 75
	}
	if candidate.LimitDown {
		weakBoard = 100
	}
	weakExpectation := negativeScale(candidate.ExpectationGap, 5)
	weakLiquidity := 0.0
	if relativeReturn < 0 {
		weakLiquidity = clamp((candidate.AmountRatio-0.8)/0.7*100, 0, 100)
	}
	activeWeakness := weighted([]weightedValue{
		{weakRelative, e.config.WeaknessWeights.Relative},
		{weakVWAP, e.config.WeaknessWeights.VWAP},
		{weakBoard, e.config.WeaknessWeights.Board},
		{weakExpectation, e.config.WeaknessWeights.Expectation},
		{weakLiquidity, e.config.WeaknessWeights.Liquidity},
	})

	strongRelative := positiveScale(relativeReturn, 5)
	strongVWAP := positiveScale(candidate.VWAPDistancePercent, 3)
	strongBoard := clamp(positiveScale(candidate.ChangePercent, 9.5), 0, 70)
	if candidate.LimitUp {
		strongBoard = 100
		if candidate.BoardBroken {
			strongBoard = 65
		}
	}
	followers := clamp(float64(candidate.SectorFollowers)/5*100, 0, 100)
	liquidity := clamp(candidate.AmountRatio/1.5*100, 0, 100)
	activeStrength := weighted([]weightedValue{
		{strongRelative, e.config.StrengthWeights.Relative},
		{strongVWAP, e.config.StrengthWeights.VWAP},
		{strongBoard, e.config.StrengthWeights.Board},
		{followers, e.config.StrengthWeights.Expectation},
		{liquidity, e.config.StrengthWeights.Liquidity},
	})

	clearance := weighted([]weightedValue{
		{clamp(float64(candidate.ConsecutiveLimitDown)/3*100, 0, 100), 0.20},
		{negativeScale(candidate.Drawdown3DPercent, 20), 0.20},
		{boolScore(candidate.LimitDownOpened), 0.25},
		{clamp(candidate.AmountRatio/1.2*100, 0, 100), 0.15},
		{activeWeakness, 0.20},
	})

	evidence := []string{
		fmt.Sprintf("辨识度 %.1f", recognition),
		fmt.Sprintf("相对环境收益 %.2f%%", relativeReturn),
	}
	if candidate.PreviousPassiveWeak {
		evidence = append(evidence, "上一状态为被动走弱，当前可评估个股自身修复拐点")
	}
	if candidate.LimitDownOpened {
		evidence = append(evidence, "旧负反馈锚已打开并释放流动性")
	}
	if candidate.LimitUp {
		evidence = append(evidence, fmt.Sprintf("新承接物涨停，板块跟随 %d 只", candidate.SectorFollowers))
	}

	return CandidateEvaluation{
		Candidate:           candidate,
		RecognitionScore:    round1(recognition),
		ActiveWeaknessScore: round1(activeWeakness),
		ActiveStrengthScore: round1(activeStrength),
		ClearanceScore:      round1(clearance),
		Evidence:            evidence,
	}
}

func (e *Engine) selectAnchor(kind AnchorKind, candidates []CandidateEvaluation) AnchorSelection {
	items := make([]CandidateEvaluation, 0)
	for _, candidate := range candidates {
		if candidate.Candidate.Kind == kind {
			items = append(items, candidate)
		}
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].RecognitionScore > items[j].RecognitionScore
	})
	selection := AnchorSelection{Kind: kind}
	if len(items) == 0 {
		selection.Evidence = []string{"没有候选对象"}
		return selection
	}
	selection.Selected = copyCandidate(items[0])
	if len(items) > 1 {
		selection.RunnerUp = copyCandidate(items[1])
		selection.ScoreGap = round1(items[0].RecognitionScore - items[1].RecognitionScore)
	} else {
		selection.ScoreGap = 100
	}
	selection.Clear = items[0].RecognitionScore >= e.config.RecognitionThreshold && selection.ScoreGap >= e.config.MinimumAnchorGap
	selection.Evidence = []string{
		fmt.Sprintf("%s辨识度 %.1f，领先第二名 %.1f", items[0].Candidate.Name, items[0].RecognitionScore, selection.ScoreGap),
	}
	if !selection.Clear {
		selection.Evidence = append(selection.Evidence, "锚点不清晰：辨识度不足或龙一与龙二过于接近")
	}
	return selection
}

func (e *Engine) evaluateBig(
	scope Scope,
	marketStress float64,
	environmentTurn float64,
	stressFactors []FactorScore,
	environmentFactors []FactorScore,
	anchors map[AnchorKind]AnchorSelection,
) SignalEvaluation {
	oldAnchor, oldClearance := strongestClearance(anchors[AnchorOldNegative], anchors[AnchorOldProfit])
	newAnchor := anchors[AnchorNewCarrier]
	newStrength := 0.0
	newSymbol := ""
	if newAnchor.Selected != nil {
		newStrength = newAnchor.Selected.ActiveStrengthScore
		newSymbol = newAnchor.Selected.Candidate.Symbol
	}
	oldSymbol := ""
	if oldAnchor != nil {
		oldSymbol = oldAnchor.Candidate.Symbol
	}

	score := weighted([]weightedValue{
		{marketStress, e.config.BigWeights.First},
		{oldClearance, e.config.BigWeights.Second},
		{environmentTurn, e.config.BigWeights.Third},
		{newStrength, e.config.BigWeights.Fourth},
	})
	factors := []FactorScore{
		{Name: "前期连续分歧", Score: round1(marketStress), Weight: e.config.BigWeights.First, Detail: joinFactorDetails(stressFactors)},
		{Name: "旧锚充分出清", Score: round1(oldClearance), Weight: e.config.BigWeights.Second},
		{Name: "环境由恶化转向改善", Score: round1(environmentTurn), Weight: e.config.BigWeights.Third, Detail: joinFactorDetails(environmentFactors)},
		{Name: "新承接物主动性", Score: round1(ne
```

### Core Architecture Module: `frontend/src/lib/theme-kline-queue.ts`
```
import { KLine } from './backend';

export type KLineEntry = { lines?: KLine[]; updatedAt?: number; day?: string; pending: boolean; error?: string };
type Flight = { controller: AbortController; selected: boolean };
export const marketDay = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());

// One queue serves both the chart and row metrics. Three background slots leave
// room for an interactive selection even while another stock is slow.
export class ThemeKLineQueue {
	readonly entries = new Map<string, KLineEntry>();
	private flights = new Map<string, Flight>();
	private wanted: string[] = [];
	private foreground = new Set<string>();
	private selected = '';
	private paused = false;
	constructor(private fetchLines: (symbol: string, signal: AbortSignal) => Promise<KLine[]>, private changed: () => void, private now = Date.now, private day = marketDay) {}

	setWanted(symbols: string[], selected: string, prefetch: string[] = []) {
		this.paused = false;
		this.selected = selected;
		this.foreground = new Set([selected, ...symbols].filter(Boolean));
		this.wanted = [...new Set([selected, ...symbols, ...prefetch].filter(Boolean))];
		for (const [symbol, flight] of this.flights) {
			if (!this.wanted.includes(symbol) || (flight.selected && symbol !== selected)) flight.controller.abort();
		}
		for (const [symbol, entry] of this.entries) {
			if (!this.wanted.includes(symbol) && !this.flights.has(symbol)) this.entries.set(symbol, { ...entry, pending: false });
		}
		for (const symbol of this.wanted) {
			const entry = this.entries.get(symbol);
			const expired = entry?.day !== this.day() || this.now() - (entry.updatedAt || 0) > 60_000;
			if (!this.flights.has(symbol) && (!entry || (expired && (!entry.error || entry.day !== this.day())))) {
				this.entries.set(symbol, { ...entry, lines: entry?.day === this.day() ? entry.lines : undefined, pending: true, error: undefined });
			}
		}
		// Bound the session cache while retaining currently used stocks.
		for (const symbol of this.entries.keys()) {
			if (this.entries.size <= 120) break;
			if (!this.wanted.includes(symbol) && !this.flights.has(symbol)) this.entries.delete(symbol);
		}
		this.changed(); this.pump();
	}

	refresh() {
		for (const symbol of this.wanted) {
			const entry = this.entries.get(symbol);
			if (entry && !this.flights.has(symbol)) this.entries.set(symbol, { ...entry, pending: true, error: undefined });
		}
		this.changed(); this.pump();
	}

	retryFailed() {
		for (const symbol of this.wanted) {
			const entry = this.entries.get(symbol);
			if (entry?.error) this.entries.set(symbol, { ...entry, pending: true, error: undefined });
		}
		this.changed(); this.pump();
	}

	pause() {
		this.paused = true;
		for (const flight of this.flights.values()) flight.controller.abort();
		for (const [symbol, entry] of this.entries) this.entries.set(symbol, { ...entry, pending: false });
	}

	private pump() {
		if (this.paused) return;
		while (this.flights.size < 4) {
			const foregroundPending = [...this.foreground].some(symbol => this.entries.get(symbol)?.pending || this.flights.has(symbol));
			const backgrounds = [...this.flights.values()].filter(f => !f.selected).length;
			const symbol = this.wanted.find(symbol => this.entries.get(symbol)?.pending && !this.flights.has(symbol)
				&& (symbol === this.selected || backgrounds < 3)
				&& (this.foreground.has(symbol) || !foregroundPending));
			if (!symbol) break;
			this.start(symbol);
		}
	}

	private start(symbol: string) {
		const controller = new AbortController();
		const flight = { controller, selected: symbol === this.selected };
		this.flights.set(symbol, flight);
		let timedOut = false;
		const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 25_000);
		void this.fetchLines(symbol, controller.signal).then(lines => {
			if (controller.signal.aborted) return;
			if (!lines.length) throw new Error('暂无日 K 数据');
			this.entries.set(symbol, { lines: [...lines].sort((a, b) => a.time.localeCompare(b.time)), updatedAt: this.now(), day: this.day(), pending: false });
		}).catch(reason => {
			if (!controller.signal.aborted || timedOut) this.entries.set(symbol, { ...this.entries.get(symbol), day: this.day(), updatedAt: this.now(), pending: false, error: timedOut ? '日 K 加载超时' : reason instanceof Error ? reason.message : '日 K 暂不可用' });
		}).finally(() => {
			clearTimeout(timer);
			this.flights.delete(symbol);
			if (controller.signal.aborted && !timedOut && !this.paused && this.wanted.includes(symbol)) {
				this.entries.set(symbol, { ...this.entries.get(symbol), pending: true });
			}
			if (!this.paused) { this.changed(); this.pump(); }
		});
	}
}

```

### Core Architecture Module: `backend/cmd/server/main.go`
```
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"easy-stock/backend/internal/agent"
	"easy-stock/backend/internal/httpapi"
	"easy-stock/backend/internal/methodology"
	"easy-stock/backend/internal/runtimelog"
)

func main() {
	addr := os.Getenv("A_STOCK_ADDR")
	if addr == "" {
		addr = "127.0.0.1:20081"
	}
	reviewDBPath := os.Getenv("A_STOCK_REVIEW_DB")
	portfolioDBPath := os.Getenv("A_STOCK_PORTFOLIO_DB")
	stockResearchDBPath := os.Getenv("A_STOCK_RESEARCH_DB")
	marketEmotionDBPath := os.Getenv("A_STOCK_MARKET_EMOTION_DB")
	themeRadarDBPath := os.Getenv("A_STOCK_THEME_RADAR_DB")
	settingsPath := os.Getenv("A_STOCK_SETTINGS_PATH")
	masteryCacheDir := os.Getenv("A_STOCK_MASTERY_CACHE")
	dataDir := ""
	if configDir, err := os.UserConfigDir(); err == nil {
		dataDir = preferredDataDir(configDir)
	}
	if reviewDBPath == "" {
		reviewDBPath = dataPath(dataDir, "reviews.db")
	}
	if settingsPath == "" {
		settingsPath = dataPath(dataDir, "settings.json")
	}
	if portfolioDBPath == "" {
		portfolioDBPath = dataPath(dataDir, "portfolio-inspections.db")
	}
	if stockResearchDBPath == "" {
		stockResearchDBPath = dataPath(dataDir, "stock-research.db")
	}
	if marketEmotionDBPath == "" {
		marketEmotionDBPath = dataPath(dataDir, "market-emotion.db")
	}
	if themeRadarDBPath == "" {
		themeRadarDBPath = dataPath(dataDir, "theme-radar.db")
	}
	if masteryCacheDir == "" {
		masteryCacheDir = dataPath(dataDir, "trading-mastery")
	}
	logDirectory := os.Getenv("A_STOCK_LOG_DIR")
	if logDirectory == "" {
		logDirectory = dataPath(dataDir, "logs")
	}
	if logDirectory != "" {
		logger, closer, err := runtimelog.ConfigureStandard(logDirectory, "backend")
		if err != nil {
			log.Printf("runtime logging unavailable: %v", err)
		} else {
			defer closer.Close()
			logger.Printf("level=info event=runtime_start component=backend version=%q", runtimeVersion())
		}
	}
	hermesHome := os.Getenv("A_STOCK_HERMES_HOME")
	if hermesHome == "" {
		hermesHome = dataPath(dataDir, "hermes-home")
	}
	hermesWorkDir := os.Getenv("A_STOCK_HERMES_WORKDIR")
	if hermesWorkDir == "" {
		hermesWorkDir, _ = os.Getwd()
	}
	codexHome := os.Getenv("A_STOCK_CODEX_HOME")
	if codexHome == "" {
		codexHome = dataPath(dataDir, "codex-home")
	}
	codexRoot := os.Getenv("A_STOCK_CODEX_RUNTIME_ROOT")
	if codexRoot == "" {
		codexRoot = filepath.Join(filepath.Dir(resolveHermesRuntimeRoot()), "codex-runtime")
	}
	agentGateway := agent.NewService(agent.ServiceConfig{Hermes: agent.HermesConfig{
		RuntimeRoot: resolveHermesRuntimeRoot(),
		Home:        hermesHome,
		WorkDir:     hermesWorkDir,
		PythonPath:  os.Getenv("A_STOCK_HERMES_PYTHON"),
	}, Codex: agent.CodexConfig{RuntimeRoot: codexRoot, Home: codexHome, WorkDir: filepath.Join(codexHome, "workspace")}})
	masteryLibrary := methodology.NewLibrary(methodology.Config{
		CacheDir:   masteryCacheDir,
		HermesHome: hermesHome,
	})
	server := httpapi.NewServer(httpapi.Config{
		Token:                os.Getenv("A_STOCK_TOKEN"),
		ReviewDBPath:         reviewDBPath,
		PortfolioDBPath:      portfolioDBPath,
		StockResearchDBPath:  stockResearchDBPath,
		RemoteDailyReviewURL: os.Getenv("A_STOCK_DAILY_REVIEW_BASE_URL"),
		MarketEmotionDBPath:  marketEmotionDBPath,
		ThemeRadarDBPath:     themeRadarDBPath,
		DuanxianxiaBaseURL:   os.Getenv("A_STOCK_DUANXIANXIA_BASE_URL"),
		WeChatAPIURL:         os.Getenv("A_STOCK_WECHAT_API_URL"),
		SettingsPath:         settingsPath,
		AgentGateway:         agentGateway,
		MasteryLibrary:       masteryLibrary,
		Logger:               log.Default(),
		StrictPersistence:    true,
	})
	if err := server.StartupError(); err != nil {
		log.Fatalf("persistent data startup failed: %v", err)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	go server.RunReviewScheduler(ctx)
	go server.RunRemoteDailyReviewScheduler(ctx)
	go server.RunMarketEmotionScheduler(ctx)
	go server.RunMasteryScheduler(ctx)
	httpServer := &http.Server{Addr: addr, Handler: server}
	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = httpServer.Shutdown(shutdownCtx)
	}()
	log.Printf("easy-stock data foundation listening on http://%s", addr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
	if err := server.Close(); err != nil {
		log.Printf("close persistent data: %v", err)
	}
}

func runtimeVersion() string {
	if value := strings.TrimSpace(os.Getenv("A_STOCK_APP_VERSION")); value != "" {
		return value
	}
	return "development"
}

func preferredDataDir(configDir string) string {
	current := filepath.Join(configDir, "easy-stock")
	if isFile(filepath.Join(current, "settings.json")) {
		return current
	}
	legacy := filepath.Join(configDir, "a-stock-ai")
	if isFile(filepath.Join(legacy, "settings.json")) {
		return legacy
	}
	return current
}

func isFile(filePath string) bool {
	info, err := os.Stat(filePath)
	return err == nil && !info.IsDir()
}

func dataPath(dataDir, name string) string {
	if dataDir == "" {
		return ""
	}
	return filepath.Join(dataDir, name)
}

func resolveHermesRuntimeRoot() string {
	if configured := os.Getenv("A_STOCK_HERMES_RUNTIME_ROOT"); configured != "" {
		return configured
	}
	candidates := []string{}
	if executable, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Clean(filepath.Join(filepath.Dir(executable), "..", "hermes-runtime")))
	}
	if cwd, err := os.Getwd(); err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "desktop", "resources", "hermes-runtime"),
			filepath.Join(cwd, "..", "desktop", "resources", "hermes-runtime"),
		)
	}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return candidate
		}
	}
	return ""
}

```

### Core Architecture Module: `backend/internal/agent/codex.go`
```
package agent

import (
	"bufio"
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"easy-stock/backend/internal/appsettings"
)

//go:embed mcp_launcher.py
var mcpLauncher string

type CodexConfig struct {
	RuntimeRoot string
	Executable  string
	Home        string
	WorkDir     string
}

type CodexRuntime struct {
	config CodexConfig
	shared *HermesRuntime
}

func NewCodexRuntime(cfg CodexConfig, shared *HermesRuntime) *CodexRuntime {
	if cfg.Executable == "" && cfg.RuntimeRoot != "" {
		name := "codex"
		if runtime.GOOS == "windows" {
			name += ".exe"
		}
		cfg.Executable = filepath.Join(cfg.RuntimeRoot, "bin", name)
	}
	return &CodexRuntime{config: cfg, shared: shared}
}

func (r *CodexRuntime) Status() Status {
	r.shared.mu.RLock()
	cfg, configured, hasKey := r.shared.llm, r.shared.configured, r.shared.hasAPIKey
	r.shared.mu.RUnlock()
	status := Status{Runtime: Codex, APIKeyConfigured: hasKey}
	if data, err := os.ReadFile(filepath.Join(r.config.RuntimeRoot, "runtime-manifest.json")); err == nil {
		var manifest struct {
			Version string `json:"version"`
		}
		if json.Unmarshal(data, &manifest) == nil {
			status.Version = manifest.Version
		}
	}
	if !filepath.IsAbs(r.config.Executable) {
		status.Message = "Codex 包内运行时路径未配置"
		return status
	}
	info, err := os.Stat(r.config.Executable)
	if err != nil || info.IsDir() {
		status.Message = "Codex 运行时不可用，请检查安装包"
		return status
	}
	status.Available = true
	if !configured {
		status.Message = "请先配置模型连接"
		return status
	}
	if !SupportsResponses(cfg) {
		status.Message = ErrModelProtocolUnsupported.Error()
		return status
	}
	status.Configured = true
	return status
}

// Config projections contain no provider key. Secrets are supplied only in the
// child environment, which shell tools are explicitly forbidden to inherit.
func (r *CodexRuntime) renderConfiguration(options PromptOptions) (string, map[string]string, error) {
	r.shared.mu.RLock()
	cfg := r.shared.llm
	r.shared.mu.RUnlock()
	settings, err := r.shared.AgentSettings()
	if err != nil {
		return "", nil, err
	}
	key, err := r.shared.ModelAPIKey()
	if err != nil {
		return "", nil, err
	}
	env := map[string]string{"EASY_STOCK_MODEL_API_KEY": key}
	var b strings.Builder
	fmt.Fprintf(&b, "model = %s\nmodel_provider = \"easy-stock\"\nweb_search = \"disabled\"\ncheck_for_update_on_startup = false\ncli_auth_credentials_store = \"ephemeral\"\n", strconv.Quote(cfg.Model))
	effort := settings.ReasoningEffort
	// Native Responses toggles (e.g. MiniMax M3) use any non-none effort
	// to enable thinking. Keep the shared UI as a toggle, not fake levels.
	if effort == "enabled" && settings.Reasoning.Wire == "openai_responses" {
		effort = "medium"
	}
	if effort != "" && effort != "default" && effort != "enabled" {
		if !strings.Contains("|none|minimal|low|medium|high|xhigh|max|", "|"+effort+"|") {
			return "", nil, fmt.Errorf("Codex 不支持当前思考强度 %s，请调整共享模型设置", effort)
		}
		fmt.Fprintf(&b, "model_reasoning_effort = %s\n", strconv.Quote(effort))
	}
	fmt.Fprintf(&b, "[model_providers.easy-stock]\nname = \"easy-stock\"\nbase_url = %s\nwire_api = \"responses\"\nenv_key = \"EASY_STOCK_MODEL_API_KEY\"\nrequires_openai_auth = false\nsupports_websockets = false\nstream_idle_timeout_ms = %d\n", strconv.Quote(strings.TrimRight(cfg.BaseURL, "/")), appsettings.NormalizeLLMResponseTimeoutSeconds(cfg.ResponseTimeoutSeconds)*1000)
	b.WriteString("[skills]\nbundled = { enabled = false }\n[analytics]\nenabled = false\n[feedback]\nenabled = false\n[shell_environment_policy]\ninherit = \"core\"\nignore_default_excludes = false\nexclude = [\"*KEY*\", \"*TOKEN*\", \"*SECRET*\", \"*PASSWORD*\", \"*COOKIE*\"]\n[features]\nmulti_agent = false\nmemories = false\nshell_snapshot = false\ngoals = false\nsleep_tool = false\nhooks = false\nplugins = false\napps = false\nskill_mcp_dependency_install = false\n")
	if options.Sandbox || options.DisableTools {
		b.WriteString("shell_tool = false\nunified_exec = false\nview_image = false\n[tools]\nview_image = false\nexperimental_request_user_input = { enabled = false }\nupdate_plan = { enabled = false }\n")
	}
	if !options.Sandbox && !options.DisableTools {
		for i, server := range settings.MCPServers {
			if !server.Enabled {
				continue
			}
			fmt.Fprintf(&b, "[mcp_servers.%s]\nrequired = true\n", strconv.Quote(server.Name))
			if server.Transport == "stdio" || server.Transport == "sse" {
				variable := fmt.Sprintf("EASY_STOCK_MCP_%d", i)
				spec, _ := json.Marshal(server)
				env[variable] = string(spec)
				fmt.Fprintf(&b, "command = %s\nargs = %s\nenv_vars = %s\n", strconv.Quote(r.shared.pythonPath), tomlStrings([]string{"-c", mcpLauncher, variable}), tomlStrings([]string{variable}))
			} else {
				fmt.Fprintf(&b, "url = %s\n", strconv.Quote(server.URL))
				headers := map[string]string{}
				names := make([]string, 0, len(server.Headers))
				for name := range server.Headers {
					names = append(names, name)
				}
				sort.Strings(names)
				for _, name := range names {
					value := server.Headers[name]
					varName := fmt.Sprintf("EASY_STOCK_MCP_%d_%d", i, len(headers))
					headers[name], env[varName] = varName, value
				}
				if len(headers) > 0 {
					fmt.Fprintf(&b, "env_http_headers = %s\n", tomlMap(headers))
				}
			}
			fmt.Fprintf(&b, "supports_parallel_tool_calls = %t\n", server.SupportsParallelToolCall)
			if server.Timeout > 0 {
				fmt.Fprintf(&b, "tool_timeout_sec = %d\n", server.Timeout)
			}
			if server.ConnectTimeout > 0 {
				fmt.Fprintf(&b, "startup_timeout_sec = %d\n", server.ConnectTimeout)
			}
		}
	}
	return b.String(), env, nil
}

func tomlStrings(items []string) string {
	quoted := make([]string, len(items))
	for i, s := range items {
		quoted[i] = strconv.Quote(s)
	}
	return "[" + strings.Join(quoted, ", ") + "]"
}
func tomlMap(items map[string]string) string {
	keys := make([]string, 0, len(items))
	for key := range items {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, strconv.Quote(key)+" = "+strconv.Quote(items[key]))
	}
	return "{ " + strings.Join(parts, ", ") + " }"
}

func (r *CodexRuntime) SyncConfiguration() error {
	if r.config.Home == "" {
		return nil
	}
	content, _, err := r.renderConfiguration(PromptOptions{})
	if err != nil {
		return err
	}
	if err = os.MkdirAll(r.config.Home, 0700); err != nil {
		return err
	}
	return writeSecureFile(filepath.Join(r.config.Home, "config.toml"), []byte(content))
}

func (r *CodexRuntime) Start(ctx context.Context) (Process, error) {
	return r.start(ctx, PromptOptions{})
}

func (r *CodexRuntime) start(ctx context.Context, options PromptOptions) (Process, error) {
	status := r.Status()
	if !status.Available || !status.Configured {
		return nil, errors.New(status.Message)
	}
	if options.AutoApprove && !options.Sandbox {
		return nil, errors.New("自动授权只能在隔离任务中启用")
	}
	if options.DisableTools && len(options.Toolsets) > 0 {
		return nil, errors.New("禁用工具时不能指定工具集")
	}
	if _, err := cleanPromptToolsets(options.Toolsets); err != nil {
		return nil, err
	}
	content, secrets, err := r.renderConfiguration(options)
	if err != nil {
		return nil, err
	}
	// A configuration generation has its own native history. Existing threads
	// never observe another generation's model/MCP/skill settings mid-turn.
	skillDigest, err := r.skillDigest()
	if err != nil {
		return nil, err
	}
	secretBytes, _ := json.Marshal(secrets)
	digest := sha256.Sum256(append([]byte(content+skillDigest), secretBytes...))
	home := filepath.Join(r.config.Home, "generations", hex.EncodeToString(digest[:12]))
	cleanup := func() {}
	if options.Sandbox {
		home, err = os.MkdirTemp("", "easy-stock-codex-task-")
		if err != nil {
			return nil, err
		}
		cleanup = func() { _ = os.RemoveAll(home) }
	}
	if err = os.MkdirAll(home, 0700); err != nil {
		cleanup()
		return nil, err
	}
	if options.Sandbox || options.DisableTools {
		r.shared.mu.RLock()
		model := r.shared.llm.Model
		r.shared.mu.RUnlock()
		catalog := map[string]any{"models": []any{map[string]any{
			"slug": model, "display_name": model, "base_instructions": systemPrompt, "supported_reasoning_levels": []any{},
			"shell_type": "disabled", "visibility": "none", "supported_in_api": true, "priority": 1,
			"support_verbosity": false, "apply_patch_tool_type": nil,
			"truncation_policy":            map[string]any{"mode": "bytes", "limit": 10000},
			"experimental_supported_tools": []string{}, "supports_reasoning_summary_parameter": false,
			"include_skills_usage_instructions": false, "include_apps_usage_instructions": false,
		}}}
		data, _ := json.Marshal(catalog)
		catalogPath := filepath.Join(home, "models.json")
		if err = writeSecureFile(catalogPath, data); err != nil {
			cleanup()
			return nil, err
		}
		content = "model_catalog_json = " + strconv.Quote(catalogPath) + "\n" + content
	}
	if err = writeSecureFile(filepath.Join(home, "config.toml"), []byte(content)); err != nil {
		cleanup()
		return nil, err
	}
	var sandbox *promptSandbox
	if options.Sandbox && !options.DisableTools {
		sandbox, err = r.shared.preparePromptSandbox(options)
		if err != nil {
			cleanup()
			return nil, err
		}
		previousCleanup := cleanup
		cleanup = func() { sandbox.close(); previousCleanup() }
		toolsets := options.Toolsets
		if len(toolsets) == 0 {
			toolsets = defaultSandboxToolsets
		}
		toolEnv := sandbox.process.env
		for _, key := range []string{"A_STOCK_AGENT_BROWSER_WRAPPER_DIR", "A_STOCK_AGENT_BROWSER_REAL"} {
			if value := os.Getenv(key); value != "" {
				toolEnv[key] = value
			}
		}
		toolEnv["PATH"] = filepath.Dir(r.shared.pythonPath) + string(os.PathListSeparator) + os.Getenv("PATH")
		if wrapper := os.Getenv("A_STOCK_AGENT_BROWSER_WRAPPER_DIR"); wrapper != "" {
			toolEnv["PATH"] = wrapper + string(os.PathListSeparator) + toolEnv["PATH"]
		}
		spec, _ := json.Marshal(ma
```

### Core Architecture Module: `backend/internal/agent/config_transaction.go`
```
package agent

import (
	"errors"
	"os"
	"path/filepath"

	"easy-stock/backend/internal/appsettings"
)

// PrepareSettings holds the runtime selection lock until the settings store
// commits. Failed projections or persistence restore both files and memory.
// On restart, settings.json remains authoritative for the active profile/runtime.
func (s *Service) PrepareSettings(next appsettings.Values, keys map[string]*string, activeKey *string) (func(bool) error, error) {
	s.mu.Lock()
	finish, err := s.configurationRollback()
	if err != nil {
		s.mu.Unlock()
		return nil, err
	}
	complete := func(success bool) error {
		defer s.mu.Unlock()
		if success {
			s.active = RuntimeID(next.AgentRuntime)
			return nil
		}
		return finish()
	}
	for id, key := range keys {
		if id != next.ActiveLLMProfileID {
			if err = s.HermesRuntime.StoreLLMProfileKey(id, key); err != nil {
				return nil, errors.Join(err, complete(false))
			}
		}
	}
	if key, ok := keys[next.ActiveLLMProfileID]; ok {
		activeKey = key
	}
	if err = s.HermesRuntime.SyncLLMProfile(next.LLM, next.ActiveLLMProfileID, activeKey); err == nil {
		err = s.codex.SyncConfiguration()
	}
	if err != nil {
		return nil, errors.Join(err, complete(false))
	}
	return complete, nil
}

func (s *Service) configurationRollback() (func() error, error) {
	type savedFile struct {
		path   string
		data   []byte
		exists bool
	}
	var files []savedFile
	paths := []string{filepath.Join(s.home, "config.yaml"), filepath.Join(s.home, ".env")}
	if s.codex.config.Home != "" {
		paths = append(paths, filepath.Join(s.codex.config.Home, "config.toml"))
	}
	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil && !os.IsNotExist(err) {
			return nil, err
		}
		files = append(files, savedFile{path, data, err == nil})
	}
	s.HermesRuntime.mu.RLock()
	cfg, configured, hasKey := s.llm, s.configured, s.hasAPIKey
	s.HermesRuntime.mu.RUnlock()
	return func() error {
		var errs []error
		for _, file := range files {
			if file.exists {
				errs = append(errs, writeSecureFile(file.path, file.data))
			} else if err := os.Remove(file.path); err != nil && !os.IsNotExist(err) {
				errs = append(errs, err)
			}
		}
		s.HermesRuntime.mu.Lock()
		s.llm, s.configured, s.hasAPIKey = cfg, configured, hasKey
		s.HermesRuntime.mu.Unlock()
		return errors.Join(errs...)
	}, nil
}

```

### Core Architecture Module: `backend/internal/agent/mcp_launcher.py`
```
"""App-owned MCP transport/tool adapter. Never sends or converts model requests."""
import os
import sys
import json

spec = json.loads(os.environ.pop(sys.argv[1]))
# Provider credentials belong to the model process, never to tool subprocesses.
for key in list(os.environ):
    if key.startswith(('CODEX_', 'OPENAI_', 'MODEL_API_KEY', 'EASY_STOCK_MCP_', 'EASY_STOCK_MODEL_')):
        os.environ.pop(key, None)
os.environ.update(spec.get('env', {}))

if spec['transport'] == 'stdio':
    if os.name == 'nt':
        # Windows execvpe does not quote arguments like subprocess does. Keep
        # multiline scripts and paths with spaces intact, and inherit the MCP
        # pipes while the launcher waits for the child process to finish.
        import subprocess
        raise SystemExit(subprocess.run([spec['command'], *spec.get('args', [])], env=os.environ).returncode)
    os.execvpe(spec['command'], [spec['command'], *spec.get('args', [])], os.environ)

import anyio
from mcp.server.stdio import stdio_server

async def relay(source, target):
    async for message in source:
        await target.send(message)

async def serve_sse():
    from mcp.client.sse import sse_client
    async with sse_client(spec['url'], headers=spec.get('headers', {}), timeout=spec.get('connect_timeout') or 30) as (remote_read, remote_write):
        async with stdio_server() as (local_read, local_write):
            async with anyio.create_task_group() as group:
                group.start_soon(relay, local_read, remote_write)
                group.start_soon(relay, remote_read, local_write)

async def serve_tools():
    import contextlib
    import uuid
    # Some upstream tool imports print diagnostics; keep stdout pure MCP.
    with contextlib.redirect_stdout(sys.stderr):
        from mcp.server import Server
        from mcp.types import Tool, TextContent, ListToolsResult, CallToolResult
        from tools.registry import registry
        import tools.web_tools
        import tools.code_execution_tool
        import tools.browser_tool
    permitted = set()
    if 'web' in spec['toolsets']:
        permitted.update(['web_search', 'web_extract'])
    if 'code_execution' in spec['toolsets']:
        permitted.add('execute_code')
    if spec.get('browser_state'):
        # Login is performed by the product's browser. This worker reads pages.
        permitted.update(['browser_navigate', 'browser_snapshot', 'browser_get_text', 'browser_scroll', 'browser_close'])
    task_id = 'easy-stock-' + uuid.uuid4().hex

    async def list_tools():
        result = []
        for name in sorted(permitted):
            schema = registry.get_schema(name)
            if name == 'execute_code':
                from tools.code_execution_tool import build_execute_code_schema
                schema = build_execute_code_schema(permitted - {'execute_code'}, mode='strict')
                schema['description'] = '在当前任务的临时工作区执行 Python 计算，输出结果至 stdout。不可访问用户文件、启动命令或直接访问网络；网页访问仅可使用已列出的 web_search/web_extract。'
                schema['parameters']['properties']['code']['description'] = 'Python 计算代码；使用 print 输出结果。'
            if schema:
                result.append(Tool(name=name, description=schema.get('description', ''), inputSchema=schema.get('parameters', {'type': 'object', 'properties': {}})))
        return result

    async def call_tool(name, arguments):
        if name not in permitted:
            raise ValueError('Tool is outside this task policy')
        def run():
            with contextlib.redirect_stdout(sys.stderr):
                return registry.dispatch(name, arguments or {}, task_id=task_id, enabled_tools=sorted(permitted))
        result = await anyio.to_thread.run_sync(run)
        text = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
        return [TextContent(type='text', text=text[:100000])]

    if hasattr(Server, 'list_tools'):
        # Hermes releases may bundle either major version of the MCP SDK.
        server = Server('easy-stock-research-tools')
        server.list_tools()(list_tools)
        server.call_tool()(call_tool)
    else:
        async def on_list_tools(ctx, params):
            return ListToolsResult(tools=await list_tools())
        async def on_call_tool(ctx, params):
            return CallToolResult(content=await call_tool(params.name, params.arguments))
        server = Server('easy-stock-research-tools', on_list_tools=on_list_tools, on_call_tool=on_call_tool)

    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())

anyio.run(serve_sse if spec['transport'] == 'sse' else serve_tools)

```

### Core Architecture Module: `backend/internal/agent/process_unix.go`
```
//go:build !windows

package agent

import (
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
)

func isolateProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error { return killProcessTree(cmd) }
}
func killProcessTree(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	// Codex MCP workers may establish separate process groups. Include those
	// descendants while the parent still owns them; never scan by executable name.
	output, _ := exec.Command("ps", "-axo", "pid=,ppid=").Output()
	children := map[int][]int{}
	for _, line := range strings.Split(string(output), "\n") {
		fields := strings.Fields(line)
		if len(fields) != 2 {
			continue
		}
		pid, _ := strconv.Atoi(fields[0])
		parent, _ := strconv.Atoi(fields[1])
		children[parent] = append(children[parent], pid)
	}
	var stopChildren func(int)
	stopChildren = func(parent int) {
		for _, pid := range children[parent] {
			stopChildren(pid)
			_ = syscall.Kill(pid, syscall.SIGKILL)
		}
	}
	stopChildren(cmd.Process.Pid)
	err := syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	if err == syscall.ESRCH {
		return os.ErrProcessDone
	}
	return err
}

```

### Core Architecture Module: `backend/internal/agent/process_windows.go`
```
//go:build windows

package agent

import (
	"os/exec"
	"strconv"
	"syscall"
)

func isolateProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x00000200, HideWindow: true}
	cmd.Cancel = func() error { return killProcessTree(cmd) }
}
func killProcessTree(cmd *exec.Cmd) error {
	if cmd.Process == nil {
		return nil
	}
	killer := exec.Command("taskkill", "/PID", strconv.Itoa(cmd.Process.Pid), "/T", "/F")
	killer.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := killer.Run(); err != nil {
		return cmd.Process.Kill()
	}
	return nil
}

```

### Core Architecture Module: `backend/internal/agent/prompt_options.go`
```
package agent

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

const (
	defaultSandboxCodeTimeout = 60
	defaultSandboxToolCalls   = 50
)

var defaultSandboxToolsets = []string{"code_execution", "web"}

var allowedSandboxToolsets = map[string]bool{
	"code_execution": true,
	"web":            true,
}

// PromptOptions controls an isolated, unattended Hermes task. Auto approval
// is intentionally coupled to Sandbox so callers cannot bypass consent while
// the agent still has access to the normal application workspace.
type PromptOptions struct {
	Sandbox          bool
	AutoApprove      bool
	DisableTools     bool
	Toolsets         []string
	BrowserStatePath string
	// Zero leaves timing to the caller. Only actual model output resets idle time.
	FirstResponseTimeout time.Duration
	IdleTimeout          time.Duration
	// Zero keeps runtime retry defaults; a positive value bounds all observed
	// attempts, including retries inside the provider runtime.
	MaxAttempts int
	OnProgress  func(PromptProgress)
}

type OptionsPrompter interface {
	PromptWithOptions(ctx context.Context, prompt string, options PromptOptions) (PromptResult, error)
}

// PromptUsingOptions preserves compatibility with lightweight test and older
// prompters while allowing HermesRuntime to enforce the sandbox for unattended jobs.
func PromptUsingOptions(ctx context.Context, prompter Prompter, prompt string, options PromptOptions) (PromptResult, error) {
	if options.AutoApprove && !options.Sandbox {
		return PromptResult{}, errors.New("Hermes 自动授权只能在隔离沙箱中启用")
	}
	if enhanced, ok := prompter.(OptionsPrompter); ok {
		return enhanced.PromptWithOptions(ctx, prompt, options)
	}
	return prompter.Prompt(ctx, prompt)
}

// PromptFullyAuthorized is for unattended product workflows (reviews,
// analysis jobs and probes), never for the interactive AI chat. It runs in an
// isolated workspace and automatically approves the limited toolsets allowed
// by that workspace.
func PromptFullyAuthorized(ctx context.Context, prompter Prompter, prompt string) (PromptResult, error) {
	return PromptUsingOptions(ctx, prompter, prompt, PromptOptions{Sandbox: true, AutoApprove: true})
}

// PromptFullyAuthorizedWithBrowserState is the unattended equivalent for a
// workflow that explicitly selected a browser login state.
func PromptFullyAuthorizedWithBrowserState(ctx context.Context, prompter BrowserStatePrompter, prompt, statePath string) (PromptResult, error) {
	if enhanced, ok := prompter.(interface {
		PromptWithOptionsAndBrowserState(context.Context, string, string, PromptOptions) (PromptResult, error)
	}); ok {
		return enhanced.PromptWithOptionsAndBrowserState(ctx, prompt, statePath, PromptOptions{Sandbox: true, AutoApprove: true, Toolsets: []string{"web"}, BrowserStatePath: statePath})
	}
	return prompter.PromptWithBrowserState(ctx, prompt, statePath)
}

type promptProcessOptions struct {
	workDir string
	env     map[string]string
	unset   []string
}

type promptSandbox struct {
	root    string
	process promptProcessOptions
}

func (s *promptSandbox) close() {
	if s == nil || s.root == "" {
		return
	}
	_ = os.RemoveAll(s.root)
}

func (r *HermesRuntime) preparePromptSandbox(options PromptOptions) (*promptSandbox, error) {
	root, err := os.MkdirTemp("", "easy-stock-hermes-sandbox-")
	if err != nil {
		return nil, fmt.Errorf("创建 Hermes 临时沙箱: %w", err)
	}
	sandbox := &promptSandbox{root: root}
	fail := func(err error) (*promptSandbox, error) {
		sandbox.close()
		return nil, err
	}

	home := filepath.Join(root, "home")
	tempDir := filepath.Join(root, "tmp")
	workDir := filepath.Join(root, "work")
	siteDir := filepath.Join(root, "python")
	for _, path := range []string{home, tempDir, workDir, siteDir} {
		if err := os.MkdirAll(path, 0o700); err != nil {
			return fail(fmt.Errorf("初始化 Hermes 临时沙箱: %w", err))
		}
	}

	baseConfig, err := r.readConfigMap()
	if err != nil {
		return fail(err)
	}
	sandboxConfig := minimalSandboxConfig(baseConfig, workDir)
	configData, err := yaml.Marshal(sandboxConfig)
	if err != nil {
		return fail(fmt.Errorf("编码 Hermes 沙箱配置: %w", err))
	}
	configPath := filepath.Join(home, "config.yaml")
	if err := writeSecureFile(configPath, configData); err != nil {
		return fail(fmt.Errorf("写入 Hermes 沙箱配置: %w", err))
	}
	if err := writeSecureFile(filepath.Join(siteDir, "sitecustomize.py"), []byte(sandboxSiteCustomize)); err != nil {
		return fail(fmt.Errorf("写入 Hermes Python 沙箱: %w", err))
	}

	if options.DisableTools && len(options.Toolsets) > 0 {
		return fail(errors.New("Hermes 禁用工具时不能同时指定工具集"))
	}
	toolsets, err := cleanPromptToolsets(options.Toolsets)
	if err != nil {
		return fail(err)
	}
	if options.DisableTools {
		// context_engine is a built-in zero-tool toolset. The minimal sandbox
		// config does not enable a context engine, so this pins Hermes to an
		// empty tool schema instead of falling back to its configured defaults.
		toolsets = []string{"context_engine"}
	} else if len(toolsets) == 0 {
		toolsets = append([]string(nil), defaultSandboxToolsets...)
	}
	sandbox.process = promptProcessOptions{
		workDir: workDir,
		env: map[string]string{
			"HOME":                   home,
			"HERMES_HOME":            home,
			"TMPDIR":                 tempDir,
			"TEMP":                   tempDir,
			"TMP":                    tempDir,
			"HERMES_CONFIG":          configPath,
			staleTimeoutEnvName:      strconv.Itoa(r.responseTimeoutSeconds()),
			"HERMES_TUI_TOOLSETS":    strings.Join(toolsets, ","),
			"HERMES_IGNORE_RULES":    "1",
			"HERMES_TUI_CHECKPOINTS": "0",
			"TERMINAL_CWD":           workDir,
			"PYTHONPATH":             siteDir,
		},
		unset: []string{
			"AGENT_BROWSER_PROFILE",
			"AGENT_BROWSER_STATE",
			"HERMES_ENV",
			"HERMES_PROFILE",
			"HERMES_YOLO_MODE",
		},
	}
	if options.BrowserStatePath != "" {
		sandbox.process.env["AGENT_BROWSER_STATE"] = options.BrowserStatePath
		sandbox.process.unset = append(sandbox.process.unset, "AGENT_BROWSER_PROFILE")
		// The selected storage state is an explicit input to this unattended
		// workflow and is intentionally kept available inside the sandbox.
		for i, key := range sandbox.process.unset {
			if key == "AGENT_BROWSER_STATE" {
				sandbox.process.unset = append(sandbox.process.unset[:i], sandbox.process.unset[i+1:]...)
				break
			}
		}
	}
	return sandbox, nil
}

func minimalSandboxConfig(base map[string]any, workDir string) map[string]any {
	config := map[string]any{}
	baseModel, _ := stringMap(base["model"])
	model := copyMapKeys(baseModel, "default", "provider", "base_url", "api_mode")
	if len(model) > 0 {
		config["model"] = model
	}
	providerName := strings.TrimSpace(stringValue(model["provider"]))
	baseProviders, _ := stringMap(base["providers"])
	if providerName != "" {
		if baseProvider, ok := stringMap(baseProviders[providerName]); ok {
			provider := copyMapKeys(baseProvider,
				"name", "api", "key_env", "default_model", "transport", "stale_timeout_seconds", "extra_body",
			)
			if len(provider) > 0 {
				config["providers"] = map[string]any{providerName: provider}
			}
		}
	}
	if serviceTier, ok := base["service_tier"].(string); ok && strings.TrimSpace(serviceTier) != "" {
		config["service_tier"] = serviceTier
	}
	baseAgent, _ := stringMap(base["agent"])
	agent := copyMapKeys(baseAgent, "system_prompt", "reasoning_effort", "easy_stock_reasoning_effort")
	config["agent"] = agent
	config["curator"] = map[string]any{"enabled": false}
	config["memory"] = map[string]any{"memory_enabled": false, "user_profile_enabled": false, "nudge_interval": 0}
	config["security"] = map[string]any{"allow_lazy_installs": false}
	config["approvals"] = map[string]any{"mode": "manual"}
	config["terminal"] = map[string]any{"cwd": workDir, "env_passthrough": []string{}}
	config["code_execution"] = map[string]any{
		"mode":           "strict",
		"timeout":        defaultSandboxCodeTimeout,
		"max_tool_calls": defaultSandboxToolCalls,
	}
	return config
}

func copyMapKeys(source map[string]any, keys ...string) map[string]any {
	result := map[string]any{}
	for _, key := range keys {
		if value, ok := source[key]; ok {
			result[key] = value
		}
	}
	return result
}

func cleanPromptToolsets(values []string) ([]string, error) {
	result := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		if !allowedSandboxToolsets[value] {
			return nil, fmt.Errorf("Hermes 沙箱不允许工具集 %q", value)
		}
		seen[value] = true
		result = append(result, value)
	}
	return result, nil
}

// The hook activates only in execute_code children, identified by the private
// RPC endpoint Hermes injects after spawning the child. The gateway itself
// keeps normal network access so it can reach the configured model provider.
const sandboxSiteCustomize = `import os
import sys

if os.environ.get("HERMES_RPC_SOCKET"):
    def _real(value):
        try:
            return os.path.realpath(os.fspath(value))
        except (TypeError, ValueError):
            return ""

    def _roots(values):
        result = []
        for value in values:
            path = _real(value)
            if path and path not in result:
                result.append(path)
        return tuple(result)

    _script_dir = os.path.dirname(_real(sys.argv[0]))
    _read_roots = _roots([
        os.environ.get("HOME", ""),
        os.environ.get("TMPDIR", ""),
        _script_dir,
        sys.prefix,
        sys.base_prefix,
        *[entry for entry in sys.path if entry],
    ])
    _write_roots = _roots([
        os.environ.get("HOME", ""),
        os.environ.get("TMPDIR", ""),
        _script_dir,
    ])
    _devices = {"/dev/null", "/dev/urandom", "NUL"}
    _rpc = os.environ.get("HERMES_RPC_SOCKET", "")

    def _inside(path, roots):
        path = _real(path)
        if not path:
            return False
        if path in _devices:
            return True
        for root 
```

### Core Architecture Module: `backend/internal/agent/prompt_progress.go`
```
package agent

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// Metrics deliberately omit model text and credentials.
type PromptProgress struct {
	Event           string `json:"event,omitempty"`
	ElapsedMS       int64  `json:"elapsed_ms"`
	FirstResponseMS int64  `json:"first_response_ms,omitempty"`
	TextBytes       int    `json:"text_bytes"`
	ReasoningBytes  int    `json:"reasoning_bytes"`
	RetryCount      int    `json:"retry_count"`
}

type PromptTimeoutError struct {
	Kind          string
	Wait          time.Duration
	Progress      PromptProgress
	RuntimeDetail string
}

func (e *PromptTimeoutError) Error() string {
	label := "等待模型首个有效响应"
	if e.Kind == "idle" {
		label = "模型持续无有效输出"
	}
	message := fmt.Sprintf("%s超过%d秒（已接收正文%d字节、思考%d字节、已观测重试%d次）", label, int(e.Wait.Seconds()), e.Progress.TextBytes, e.Progress.ReasoningBytes, e.Progress.RetryCount)
	if e.RuntimeDetail != "" {
		message += "；运行时详情：" + e.RuntimeDetail
	}
	return message
}
func (e *PromptTimeoutError) Unwrap() error { return context.DeadlineExceeded }

type PromptRetryLimitError struct {
	MaxAttempts int
	Progress    PromptProgress
}

func (e *PromptRetryLimitError) Error() string {
	return fmt.Sprintf("模型当前阶段已达%d次尝试上限，停止重复生成（已接收正文%d字节、思考%d字节）", e.MaxAttempts, e.Progress.TextBytes, e.Progress.ReasoningBytes)
}

type promptWatchdog struct {
	options      PromptOptions
	started      time.Time
	timer        *time.Timer
	kind         string
	wait         time.Duration
	received     bool
	lastNotified time.Time
	progress     PromptProgress
	lastRetry    string
}

func newPromptWatchdog(options PromptOptions) *promptWatchdog {
	w := &promptWatchdog{options: options, started: time.Now()}
	w.reset("first_response", options.FirstResponseTimeout)
	return w
}
func (w *promptWatchdog) reset(kind string, wait time.Duration) {
	w.kind, w.wait = kind, wait
	if wait <= 0 {
		if w.timer != nil {
			w.timer.Stop()
			w.timer = nil
		}
		return
	}
	if w.timer == nil {
		w.timer = time.NewTimer(wait)
		return
	}
	if !w.timer.Stop() {
		select {
		case <-w.timer.C:
		default:
		}
	}
	w.timer.Reset(wait)
}
func (w *promptWatchdog) channel() <-chan time.Time {
	if w.timer == nil {
		return nil
	}
	return w.timer.C
}
func (w *promptWatchdog) close() {
	if w.timer != nil {
		w.timer.Stop()
	}
}
func (w *promptWatchdog) snapshot() PromptProgress {
	p := w.progress
	p.ElapsedMS = time.Since(w.started).Milliseconds()
	return p
}
func (w *promptWatchdog) timeout() error {
	return &PromptTimeoutError{Kind: w.kind, Wait: w.wait, Progress: w.snapshot()}
}
func (w *promptWatchdog) retryLimitError() error {
	if w.options.MaxAttempts > 0 && w.progress.RetryCount >= w.options.MaxAttempts {
		return &PromptRetryLimitError{MaxAttempts: w.options.MaxAttempts, Progress: w.snapshot()}
	}
	return nil
}
func (w *promptWatchdog) observe(frame rpcFrame) {
	event := eventType(frame)
	text := firstNonEmpty(eventText(frame, "delta"), eventText(frame, "text"), eventText(frame, "content"))
	active := false
	retrying := false
	switch event {
	case "message.delta":
		w.progress.TextBytes += len(text)
		active = text != ""
	case "reasoning.delta":
		w.progress.ReasoningBytes += len(text)
		active = text != ""
	case "message.complete":
		active = text != ""
		if len(text) > w.progress.TextBytes {
			w.progress.TextBytes = len(text)
		}
	case "notification.show", "status.update", "thinking.delta":
		// Retry/wait notices are diagnostics, never evidence of generation.
		status := firstNonEmpty(eventText(frame, "kind"), eventText(frame, "key")) + " " + text
		lower := strings.ToLower(status)
		if (strings.Contains(lower, "retry") || strings.Contains(lower, "重试")) && status != w.lastRetry {
			w.lastRetry = status
			w.progress.RetryCount++
			w.progress.Event = "retry"
			retrying = true
		}
	}
	if active {
		if !w.received {
			w.received = true
			w.progress.FirstResponseMS = time.Since(w.started).Milliseconds()
		}
		w.progress.Event = event
		w.reset("idle", w.options.IdleTimeout)
	}
	if w.options.OnProgress != nil && (active || retrying) && (w.lastNotified.IsZero() || time.Since(w.lastNotified) >= 5*time.Second || retrying || event == "message.complete") {
		w.lastNotified = time.Now()
		w.options.OnProgress(w.snapshot())
	}
}

```

### Core Architecture Module: `backend/internal/agent/prompt_timeouts.go`
```
package agent

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"gopkg.in/yaml.v3"
)

// The host watchdog owns first-response, idle and total deadlines for bounded
// sandbox prompts. Hermes' Responses adapter also applies stale_timeout_seconds to
// elapsed wall time, even while reasoning/text is streaming. Keep that inner
// ceiling outside the host deadline, in a private per-call configuration.
func configurePromptTimeouts(ctx context.Context, options PromptOptions, process *promptProcessOptions) error {
	deadline, bounded := ctx.Deadline()
	if !options.Sandbox || !bounded || options.FirstResponseTimeout <= 0 || options.IdleTimeout <= 0 {
		return nil
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	configPath := process.env["HERMES_CONFIG"]
	if configPath == "" || configPath != filepath.Join(process.env["HERMES_HOME"], "config.yaml") {
		return fmt.Errorf("模型等待配置必须位于本次沙箱目录")
	}
	var config map[string]any
	data, err := os.ReadFile(configPath)
	if err == nil {
		err = yaml.Unmarshal(data, &config)
	}
	if err != nil {
		return fmt.Errorf("准备模型等待配置: %w", err)
	}
	if config == nil {
		config = map[string]any{}
	}
	// Round up, with teardown margin, so the Go context always expires first.
	seconds := int((time.Until(deadline)+time.Second-1)/time.Second) + 10
	model, _ := stringMap(config["model"])
	providerID := firstNonEmpty(stringValue(model["provider"]), providerSlug)
	providers, ok := stringMap(config["providers"])
	if !ok {
		providers = map[string]any{}
	}
	provider, ok := stringMap(providers[providerID])
	if !ok {
		provider = map[string]any{}
	}
	provider["stale_timeout_seconds"] = seconds
	provider["request_timeout_seconds"] = seconds
	// A model-specific setting takes precedence over the provider-wide one.
	if models, ok := stringMap(provider["models"]); ok {
		if selected, ok := stringMap(models[stringValue(model["default"])]); ok {
			selected["stale_timeout_seconds"] = seconds
			selected["timeout_seconds"] = seconds
		}
	}
	providers[providerID] = provider
	config["providers"] = providers
	if options.MaxAttempts > 0 {
		agentConfig, ok := stringMap(config["agent"])
		if !ok {
			agentConfig = map[string]any{}
		}
		agentConfig["api_max_retries"] = options.MaxAttempts
		config["agent"] = agentConfig
	}
	data, err = yaml.Marshal(config)
	if err == nil {
		err = writeSecureFile(configPath, data)
	}
	if err != nil {
		return fmt.Errorf("写入模型等待配置: %w", err)
	}
	process.env[staleTimeoutEnvName] = strconv.Itoa(seconds)
	process.env["HERMES_API_TIMEOUT"] = strconv.Itoa(seconds)
	process.env["HERMES_STREAM_STALE_TIMEOUT"] = strconv.Itoa(seconds)
	process.env["HERMES_LOCAL_STREAM_STALE_TIMEOUT"] = strconv.Itoa(seconds)
	process.env["HERMES_CODEX_HARD_TIMEOUT_SECONDS"] = strconv.Itoa(seconds)
	// Go observes meaningful reasoning/text rather than transport heartbeats;
	// avoid a second watchdog reconnecting earlier than the configured wait.
	process.env["HERMES_CODEX_TTFB_TIMEOUT_SECONDS"] = "0"
	process.env["HERMES_CODEX_EVENT_STALE_TIMEOUT_SECONDS"] = "0"
	return nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5** (2026-09-13): **feat: 概念维度贯通（梯队概念云 / 选股概念列 / 自选概念标签）**
  *Symptoms*: ## 内容  对标 tick-stock-panel 的「概念」呈现方式，把每股所属概念标签贯通到三个板块（数据复用现有东财股票概念目录，StockCatalog）：  ### 连板梯队（短线连板页） - 每个梯队层级展开后顶部渲染**概念标签云**：按层级内命中概念股数降序（如「共封装光学(CPO) 6」「创新药 4」），高频概念高亮 - 个股卡片新增概念 chips（首板/高位层 4 个、紧凑模式 2 个） - 数据本就在 `raw_concepts` 字段里，本 PR 只补 UI  ### 策略选股 - 后端：`screener.Service` 新增可选 `ConceptLookup` 依赖，命中结果每股附最多 3 个概念；概念目录不可用时静默跳过并提示 - 前端：结果表新增「所属概念」列  ### 工作台自选 - 新接口 `GET /api/v1/stocks/concepts?symbols=...`（目录反查，60 只上限，limit 可调） - 工作台自选行情行名称旁渲染概念 chips（前 2 个）  ### 兼容性细节 - 概念查找同时匹配规范形（600519.SH）与纯 6 位码（600519）两种符号——screener 携带的是东财 clist 代码  ### 验证 - `go test ./...` 全绿；前端 tsc / vitest（161 个）/ vite build 全过 - 浏览器实测：梯队概念云与个股 chips、选股概念列（华为概念/军工/5G概念等）、自选概念标签（茅台→电商概念/超级品牌）均正常渲染  > 基于 #4 之上（前四个 commit 与前序 PR 相同），建议按 #2 → #3 → #4 → 本 PR 顺序合并。
  **Post-Mortem & Fix Analysis**:
  > 存在个人信息

- **Issue #4** (2026-09-13): **feat: 策略选股引擎（内置 17 策略 + 指标流水线）**
  *Symptoms*: ## 内容  把 tick-stock-panel 的「选股引擎 + 指标流水线」能力移植到 easy-stock 自有数据面，新增侧栏板块**策略选股**。  > 基于 #2/#3 的提交之上（前三个 commit 与之相同），建议按 #2 → #3 → 本 PR 顺序合并。  ### 后端 - `internal/screener`：**两级策略引擎**   - 快照策略（8 个）：放量上涨 / 温和放量上行 / 高换手活跃 / 主力净流入 / 超跌反弹 / 中期强势 / 小市值活跃 / 低估破净修复——东财全市场快照内存过滤，毫秒级   - K线策略（9 个）：均线多头排列 / 放量突破20日高 / MACD金叉 / MACD多头 / RSI超卖回升 / KDJ金叉 / 收复布林中轨 / 五连阳 / 涨停回踩——对受控计算池逐只计算（快照命中优先 + 成交额保底，默认上限 300 只） - 纯 Go 指标流水线：SMA / EMA / MACD / RSI / KDJ / BOLL，含单元测试 - 东财快照扩展字段：量比 / 总市值 / 流通市值 / PE / PB / 主力净流入 / 5日与60日涨幅（f10/f20/f21/f9/f23/f62/f109/f24） - `GET /api/v1/screener/strategies`、`POST /api/v1/screener/run`（150 秒预算 + 90 秒结果缓存）  ### 前端 - 侧栏新增「策略选股」：分组策略目录（量价/资金/动量/规模/趋势K线/指标K线/形态K线）勾选多选 - 运行选项：排除 ST/次新、最小成交额、K线池上限 - 结果表：现价/涨幅/换手/量比/流通市值 + 命中策略标签与详情（金叉位置、HIST、量比倍数、MA 数值），点行直达个股 AI 分析；支持「只看多策略共振」  ### 验证 - `go test ./...` 全绿（screener 10 个新测试：指标正确性 / ST与停牌过滤 / 计算池上限 / 目录完整性） - 真实数据端到端：2891 只扫描（排除ST/次新后）→ 107 只命中，K线池 300 只 70 秒；浏览器实测截图验收（依顿电子三策略共振等详情渲染正常） - 前端 tsc / vitest（161 个）/ vite build 全过
  **Post-Mortem & Fix Analysis**:
  > 存在个人信息

- **Issue #3** (2026-09-22): **feat: 工作台市场看板（借鉴 tick-stock-panel）**
  *Symptoms*: ## 内容  把 [shy3130/tick-stock-panel](https://github.com/shy3130/tick-stock-panel)（MIT）的看板页设计适配进工作台，数据全部走 easy-stock 自有 provider。  > 本 PR 基于 #2 的提交之上（前两个 commit 与 #2 相同），**建议先合并 #2**，合并后本 PR 的 diff 会自动只剩看板改版一个提交。  ### 后端 - `GET /api/v1/market/breadth`：东财全市场快照（clist 56 页并发拉取 + 45 秒服务端缓存），聚合涨平跌广度、10 档涨跌分布、强势/弱势、平均/中位涨跌、成交额与四个 Top8 榜单 - `GET /api/v1/market/concepts`：东财概念板块动量（新增 f140 领涨股代码解析）  ### 工作台改版 - 看板 KPI 行：强势/弱势、涨停/跌停+封板率、最高连板、首板/连板、昨涨停溢价、平均换手 - 三列区：涨跌分布/广度卡（直方图 + 涨平跌横条 + 均/中位涨跌）、情绪雷达（6 维 SVG，中心为情绪总分）、涨停梯队迷你视图 - 概念热度 / 行业热度卡：领涨领跌 Top5，领涨股点击直达个股 AI 分析 - 四列榜单：涨幅榜 / 跌幅榜 / 成交额榜 / 活跃换手（Top8，行点击直达个股分析） - 监控中心组件按需求**未移植**；自选行情、市场热度、情绪催化、财联社电报区块保留  ### 验证 - `go test ./...` 全绿（eastmoney 新增 snapshot 聚合/解析/规范化 5 个测试） - 前端 tsc / vitest（161 个）/ vite build 全过 - 浏览器实测截图验收：分布直方图、雷达、梯队、双热度卡、四榜单真实数据渲染正常（当日全市场 5210 只，跌 4567 / 涨 605）
  **Post-Mortem & Fix Analysis**:
  > 你好，如果有参与easy-stock共同维护的意愿，可以联系我对齐easy-stock的目标和愿景

- **Issue #2** (2026-09-13): **feat: integrate chan.py engine and add 缠论选股 workspace**
  *Symptoms*: ## 内容  包含两个提交：  ### 1. feat: sync in-progress engines and workspaces from prior sessions 把此前多轮开发但未提交的工作落到提交基线上（czsc 缠论个股分析、雪球热榜、自选股日报、交易复盘、催化剂、板块雷达、工作台与暗色主题等，88 个文件）。这些是后续 chan.py 集成的编译前提。  ### 2. feat: integrate chan.py engine and add chan screener workspace 基于 [Vespa314/chan.py](https://github.com/Vespa314/chan.py)（MIT）新增缠论引擎与选股板块：  - **Python 引擎**：`integrations/chanpy-service/` vendored chan.py 核心 + 自定义 easy-stock 后端数据源（`DataAPI/backendAPI.py`），服务脚本 `chanpy_service.py` 提供 `analyze`（单股完整笔/线段/中枢/一二三类买卖点 + 确定性评分）与 `screen`（批量选股）两个子命令；核心计算只依赖 Python ≥3.11 标准库 - **Go 后端**：`backend/internal/chanscreener` 进程外调用（沿用 chananalysis/czsc 的探测、令牌回调、缓存与串行锁约定），新增 3 条路由 `/api/v1/stocks/chan-screen`、`/api/v1/stocks/chanpy-analysis`、`/api/v1/stocks/chan-screen-status` - **前端**：顶栏新增「缠论选股」板块——股票池（自定义 / 自选股日报配置 / 热门股票榜）、买卖点类型与时效过滤、中枢位置与当前笔方向条件、确定性评分排序，点击行展开个股结构详情 - **文档**：`docs/chan-engine.md` 双引擎说明与部署方式；`backend/docs/api-routes.md` 路由条目  ## 验证  - `go build ./...` + `go test ./...` 全绿（chanscreener 新增 8 个测试；顺带修复了 xueqiu `TestInflightDedup` 的随机失败——根因是 map 遍历拼 URL 导致缓存/in-flight key 分裂，已排序规范化并加回归测试） - 前端 `tsc --noEmit`、`vitest`（161 个）、`vite build` 全部通过 - 真实数据端到端：6 只股票批量选股 1.5s，茅台 500 根日线 25 笔 / 2 中枢 / 12 买卖点  ## 说明  - `documents/`、`backend/catalyst_candidates.json`、根目录 `manifest.json` 为运行时数据，本次加入 `.gitignore` - 评分与选股结果仅作研究参考，不构成投资建议
  **Post-Mortem & Fix Analysis**:
  > 存在个人信息

- **Issue #1** (2026-09-29): **[Feature] OrcaRouter provider support for easy-stock**
  *Symptoms*: easy-stock is an AI-native desktop research workbench for individual A-share investors that models the structure behind prices — leading themes, limit-up ladders, sentiment cycles — and whose post-market review flow gathers write-ups scattered across Xueqiu, Taoguba, and WeChat public accounts into one timeline, distilling a cross-author consensus with conditions to verify the next trading day.  The design choice that makes this dependable is the local Hermes Runtime: model calls, sessions, and tool routing run through one gateway so business code is never bound to a single vendor. Users already configure OpenAI, DeepSeek, Qwen, Moonshot, Anthropic, or any OpenAI-compatible endpoint by pasting an API base URL and key. Adding OrcaRouter as another selectable entry would give those users a wider model choice through a familiar setup step.  ## Proposal  I'm an engineer on the OrcaRouter team. I'd like to propose OrcaRouter as an optional provider for easy-stock. It would be additive only — a new entry beside the providers you already list, leaving existing provider configuration and behavior untouched.  ## What users would gain  easy-stock's scheduled and batch tasks — auto-syncing big-V articles, per-stock portfolio inspections — make consistent availability and predictable spend important. The capabilities most relevant:  - one OpenAI-compatible endpoint across many chat and reasoning models, so a user can use a cheaper model for daily consensus summaries and a stronger one fo
  **Post-Mortem & Fix Analysis**:
  > 感谢，未来easy-stock会考虑引入第三方中转站，但不是现在

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

### Incident Patch 1: `c7488138` (2026-10-06)
**Commit Message**: fix: restore theme radar strength during market holidays

**File**: `backend/internal/sector/radar_freshness_test.go` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+package sector
+
+import (
+	"testing"
+	"time"
+)
+
+func TestRadarSnapshotAgeCountsExchangeSessions(t *testing.T) {
+	for _, tc := range []struct {
+		name, date, asOf string
+		age              int
+	}{
+		{"national day closure", "2026-09-30", "2026-10-06T13:00:00+08:00", 0},
+		{"first session after holiday", "2026-09-30", "2026-10-08T10:00:00+08:00", 1},
+		{"weekend after two sessions", "2026-09-30", "2026-10-11T12:00:00+08:00", 2},
+		{"third session expires snapshot", "2026-09-30", "2026-10-12T10:00:00+08:00", 3},
+		{"mid autumn closure", "2026-09-24", "2026-09-27T12:00:00+08:00", 0},
+		{"Shanghai date from UTC clock", "2026-09-30", "2026-10-07T17:00:00Z", 1},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			now, err := time.Parse(time.RFC3339, tc.asOf)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if age := tradingDayAge(tc.date, now); age != tc.age {
+				t.Fatalf("snapshot %s at %s aged %d sessions, want %d", tc.date, tc.asOf, age, tc.age)
+			}
+		})
+	}
+}
```

**File**: `backend/internal/sector/radar_fusion.go` (modified, +20/-5)
```diff
@@ -112,7 +112,7 @@ func buildIndustryRadarOverviews(items []foundation.MarketIndustryMomentum, meta
 		)
 		dailyScore := blendProviderAndComposite(item.Score, dailyComposite, dailyOK)
 		fiveDayScore := blendProviderAndComposite(item.Score, fiveDayComposite, fiveDayOK)
-		tradeDate := firstNonEmptyRadar(item.Meta.TradeDate, meta.TradeDate, shanghaiDate(now))
+		tradeDate := firstNonEmptyRadar(item.Meta.TradeDate, meta.TradeDate, radarMarketDate(now))
 		matched := item.RisingCount + item.FallingCount
 		result = append(result, foundation.ThemeOverview{
 			Theme:                radarIndustryThemeID(item.Code, item.Name),
@@ -369,6 +369,13 @@ func mergeRadarPair(industry foundation.ThemeOverview, kaipanla foundation.Theme
 	result.IndustryFiveDayScore = industry.IndustryFiveDayScore
 	result.DailyStrengthScore = fusedRadarScore(industry.IndustryDailyScore, kaipanla.KaipanlaDailyScore)
 	result.FiveDayStrengthScore = fusedRadarScore(industry.IndustryFiveDayScore, kaipanla.KaipanlaFiveDayScore)
+	// Membership can arrive before its strength calculation. Keep the ready
+	// industry's scores visible until the Kaipanla scores can join the fusion.
+	if kaipanla.Provisional {
+		result.Provisional = industry.Provisional
+		result.DailyStrengthScore = max(0, industry.IndustryDailyScore-radarSinglePenalty)
+		result.FiveDayStrengthScore = max(0, industry.IndustryFiveDayScore-radarSinglePenalty)
+	}
 	result.TrendScore = result.DailyStrengthScore
 	result.TrendStage = radarTrendStage(result.TrendScore)
 	return result
@@ -616,8 +623,8 @@ func fusedRadarMeta(
 	if industryMeta.FetchedAt.After(fetchedAt) {
 		fetchedAt = industryMeta.FetchedAt
 	}
-	tradeDate := firstNonEmptyRadar(industryMeta.TradeDate, snapshot.TradeDate, shanghaiDate(now))
-	carryForward := hasKaipanla && snapshot.TradeDate != shanghaiDate(now)
+	tradeDate := firstNonEmptyRadar(industryMeta.TradeDate, snapshot.TradeDate, radarMarketDate(now))
+	carryForward := hasKaipanla && tradingDayAge(snapshot.TradeDate, now) > 0
 	reasons := []string{}
 	if snapshotErr != nil {
 		reasons = append(reasons, snapshotErr.Error())
@@ -645,7 +652,7 @@ func fusedRadarMeta(
 }
 
 func tradingDayAge(tradeDate string, now time.Time) int {
-	location := now.Location()
+	location := time.FixedZone("Asia/Shanghai", 8*60*60)
 	date, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(tradeDate), location)
 	if err != nil {
 		return 0
@@ -656,13 +663,21 @@ func tradingDayAge(tradeDate string, now time.Time) int {
 	}
 	age := 0
 	for current := date.AddDate(0, 0, 1); !current.After(today); current = current.AddDate(0, 0, 1) {
-		if current.Weekday() != time.Saturday && current.Weekday() != time.Sunday {
+		if foundation.IsAStockTradingDay(current) {
 			age++
 		}
 	}
 	return age
 }
 
+func radarMarketDate(now time.Time) string {
+	day := now.In(time.FixedZone("Asia/Shanghai", 8*60*60))
+	for !foundation.IsAStockTradingDay(day) {
+		day = day.AddDate(0, 0, -1)
+	}
+	return shanghaiDate(day)
+}
+
 func radarTrendStage(score int) string {
 	switch {
 	case score >= 75:
```

**File**: `backend/internal/sector/radar_progress.go` (modified, +20/-5)
```diff
@@ -4,6 +4,7 @@ import (
 	"context"
 	"fmt"
 	"log"
+	"strings"
 	"time"
 
 	"easy-stock/backend/internal/foundation"
@@ -39,15 +40,29 @@ func (p *RadarProvider) ProgressiveOverviews(ctx context.Context, publish func(f
 		if len(snapshot.Themes) > 0 && tradingDayAge(snapshot.TradeDate, p.now()) <= 2 {
 			themes := snapshot.Themes[:min(len(snapshot.Themes), max(24, p.fallbackFill))]
 			kaipanlaItems = p.buildKaipanlaRadarOverviews(snapshot, themes, quotes, strengths, tradingDayAge(snapshot.TradeDate, p.now()))
+			for i := range kaipanlaItems {
+				_, scored := strengths[strings.TrimPrefix(kaipanlaItems[i].Theme, "kpl:")]
+				kaipanlaItems[i].Provisional = steps["strength"] != "ready" || !scored
+			}
 		}
 		items := rankAndSelectRadarOverviews(mergeRadarOverviews(industryItems, kaipanlaItems), p.fallbackFill)
-		for i := range items {
-			items[i].Provisional = steps["strength"] != "ready" || steps["industry"] != "ready" || steps["kaipanla"] != "ready"
+		stepError := func(step string) error {
+			if message := errors[step]; message != "" {
+				return fmt.Errorf("%s", message)
+			}
+			return nil
+		}
+		meta := fusedRadarMeta(p.now(), snapshot, fetchMeta, stepError("kaipanla"), industryMeta, stepError("industry"), len(kaipanlaItems) > 0, len(industryItems) > 0)
+		if strengthErr := stepError("strength"); strengthErr != nil && errors["strength"] != errors["kaipanla"] {
+			meta.Stale = true
+			meta.FallbackReason = strings.Join(uniqueRadarStrings([]string{meta.FallbackReason, strengthErr.Error()}), "；")
 		}
-		meta := fusedRadarMeta(p.now(), snapshot, fetchMeta, nil, industryMeta, nil, len(kaipanlaItems) > 0, len(industryItems) > 0)
 		stage := "base"
-		if steps["strength"] == "ready" {
-			stage = "enriched"
+		for _, item := range items {
+			if !item.Provisional {
+				stage = "enriched"
+				break
+			}
 		}
 		stepCopy := map[string]string{}
 		errorCopy := map[string]string{}
```

**File**: `backend/internal/sector/radar_progress_test.go` (modified, +137/-2)
```diff
@@ -3,6 +3,7 @@ package sector
 import (
 	"context"
 	"errors"
+	"strings"
 	"testing"
 	"time"
 
@@ -37,8 +38,8 @@ func TestProgressiveOverviewPublishesIndustryBeforeSlowMembership(t *testing.T)
 		if len(first.Data) == 0 || first.Steps["industry"] != "ready" || first.Steps["kaipanla"] != "loading" {
 			t.Fatalf("did not publish fast source: %+v", first)
 		}
-		if len(first.Data[0].LeaderStocks) != 1 || !first.Data[0].Provisional {
-			t.Fatalf("missing preview membership: %+v", first.Data)
+		if len(first.Data[0].LeaderStocks) != 1 || first.Data[0].Provisional || first.Data[0].DailyStrengthScore <= 0 || first.Stage != "enriched" {
+			t.Fatalf("ready industry strength was hidden behind slow membership: %+v", first)
 		}
 	case <-time.After(time.Second):
 		t.Fatal("fast source blocked behind slow membership")
@@ -59,6 +60,140 @@ func TestProgressiveOverviewPublishesIndustryBeforeSlowMembership(t *testing.T)
 	}
 }
 
+func finalRadarProgress(t *testing.T, provider *RadarProvider) foundation.ThemeProgress {
+	t.Helper()
+	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
+	defer cancel()
+	var final foundation.ThemeProgress
+	provider.ProgressiveOverviews(ctx, func(value foundation.ThemeProgress) { final = value })
+	if final.Refreshing || len(final.Steps) == 0 {
+		t.Fatalf("refresh did not finish: %+v", final)
+	}
+	return final
+}
+
+func TestProgressiveOverviewPreservesIndustryStrengthWhenKaipanlaFails(t *testing.T) {
+	now := time.Date(2026, 10, 6, 13, 0, 0, 0, time.FixedZone("CST", 8*3600))
+	for _, tc := range []struct {
+		name   string
+		source RadarSnapshotSource
+	}{
+		{name: "unavailable"},
+		{name: "expired", source: fakeRadarSource{snapshot: duanxianxia.Snapshot{
+			ID: "old", TradeDate: "2026-09-24", Themes: []duanxianxia.Theme{{Code: "801001", Name: "芯片", Rank: 1}},
+		}}},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			provider := NewRadarProvider(tc.source, nil, nil, RadarProviderConfig{
+				Now: func() time.Time { return now },
+				IndustryMomentum: fakeIndustryMomentumSource{items: []foundation.MarketIndustryMomentum{
+					{Code: "bio", Name: "生物制品", Score: 88},
+				}},
+			})
+			final := finalRadarProgress(t, provider)
+			if final.Steps["industry"] != "ready" || final.Steps["kaipanla"] != "error" || final.Steps["strength"] != "error" {
+				t.Fatalf("unexpected source states: %+v", final)
+			}
+			if len(final.Data) != 1 || final.Data[0].Provisional || final.Data[0].DailyStrengthScore <= 0 || final.Data[0].FiveDayStrengthScore <= 0 || final.Stage != "enriched" {
+				t.Fatalf("valid industry scores were hidden: %+v", final)
+			}
+			if !final.Meta.Stale || !strings.Contains(final.Meta.FallbackReason, final.Errors["kaipanla"]) {
+				t.Fatalf("source failure was omitted from metadata: %+v", final)
+			}
+			if final.Data[0].TradeDate != "2026-09-30" {
+				t.Fatalf("holiday industry date should be the last session: %+v", final.Data[0])
+			}
+		})
+	}
+}
+
+func TestProgressiveOverviewUsesIndustryScoreWhenMatchedKaipanlaStrengthFails(t *testing.T) {
+	now := time.Date(2026, 9, 17, 10, 0, 0, 0, time.FixedZone("CST", 8*3600))
+	provider := NewRadarProvider(fakeRadarSource{snapshot: duanxianxia.Snapshot{
+		ID: "s", TradeDate: "2026-09-17", Themes: []duanxianxia.Theme{
+			{Code: "801001", Name: "芯片", Rank: 1},
+			{Code: "803023", Name: "AI应用", Rank: 2},
+		},
+	}}, &fakeRadarStrengthFallback{err: errors.New("constituents unavailable")}, nil, RadarProviderConfig{
+		Now: func() time.Time { return now },
+		IndustryMomentum: fakeIndustryMomentumSource{items: []foundation.MarketIndustryMomentum{
+			{Code: "semi", Name: "半导体", Score: 82},
+		}},
+	})
+	final := finalRadarProgress(t, provider)
+	chip, found := findRadarOverview(final.Data, "芯片")
+	if !found || chip.Provisional || chip.Source != radarFusionSource || chip.DailyStrengthScore != chip.IndustryDailyScore-radarSinglePenalty || chip.FiveDayStrengthScore != chip.IndustryFiveDayScore-radarSinglePenalty {
+		t.Fatalf("unfinished Kaipanla strength replaced the industry score: %+v", final)
+	}
+	ai, found := findRadarOverview(final.Data, "AI应用")
+	if !found || !ai.Provisional {
+		t.Fatalf("unscored standalone theme must stay provisional: %+v", final.Data)
+	}
+	if final.Steps["kaipanla"] != "ready" || final.Steps["strength"] != "error" || !final.Meta.Stale || !strings.Contains(final.Meta.FallbackReason, "题材强度暂不可用") {
+		t.Fatalf("strength failure was not reported: %+v", final)
+	}
+}
+
+func TestProgressiveOverviewReadinessIsPerThemeWhenIndustryFails(t *testing.T) {
+	now := time.Date(2026, 9, 17, 10, 0, 0, 0, time.FixedZone("CST", 8*3600))
+	provider := NewRadarProvider(fakeRadarSource{snapshot: duanxianxia.Snapshot{
+		ID: "s", TradeDate: "2026-09-17", Themes: []duanxianxia.Theme{
+			{Code: "801001", Name: "芯片", Rank: 1},
+			{Code: "803023", Name: "AI应用", Rank: 2},
+		},
+	}}, nil, nil, RadarProviderConfig{
+		Now:              func() time.Time { return now },
+		IndustryMomentum: fakeIndustryMome
```

---

### Incident Patch 2: `424b8f61` (2026-10-05)
**Commit Message**: fix: increase market overview content font sizes

**File**: `frontend/src/styles.css` (modified, +101/-101)
```diff
@@ -6979,61 +6979,61 @@ a:focus-visible {
 .market-overview-nav button em { padding: 2px 5px; border-radius: 999px; background: var(--theme-surface-soft, #edf1f5); color: var(--theme-subtle, #8a96a5); font-size: 8px; font-style: normal; white-space: nowrap; }
 .market-overview-nav button.active em { background: var(--theme-blue-soft, #e9f3ff); color: var(--theme-blue, #4f7da9); }
 
-.market-overview-main { min-width: 0; padding: 15px; background: var(--theme-surface-soft, #f7f9fc); }
+.market-overview-main { font-size: calc(1em + 5px); min-width: 0; padding: 15px; background: var(--theme-surface-soft, #f7f9fc); }
 .market-overview-hero { display: flex; align-items: center; justify-content: space-between; gap: 18px; min-height: 68px; padding: 0 4px 13px; }
 .market-overview-hero > div:first-child { display: grid; gap: 2px; }
 .market-overview-hero > div:first-child > span { color: var(--theme-blue, #2476d2); font-size: 11px; font-weight: 750; letter-spacing: .08em; }
 .market-overview-hero h2 { margin: 0; color: var(--theme-text, #1f3045); font-size: 20px; }
-.market-overview-hero p { margin: 0; color: var(--theme-muted, #788697); font-size: 12px; }
+.market-overview-hero p { margin: 0; color: var(--theme-muted, #788697); font-size: 17px; }
 .market-overview-hero > div:last-child { display: flex; align-items: center; gap: 7px; }
-.market-overview-hero button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 0 11px; border: 1px solid var(--theme-line, #cad5e1); border-radius: 8px; background: var(--theme-surface, #ffffff); color: var(--theme-muted, #506176); font-size: 12px; cursor: pointer; }
+.market-overview-hero button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 0 11px; border: 1px solid var(--theme-line, #cad5e1); border-radius: 8px; background: var(--theme-surface, #ffffff); color: var(--theme-muted, #506176); font-size: 17px; cursor: pointer; }
 .market-overview-hero button:hover { border-color: var(--theme-blue-line, #9fbfe0); color: var(--theme-blue, #2476d2); }
 .market-overview-hero button:disabled { opacity: .55; cursor: default; }
 .market-overview-hero .market-ai-button { border-color: var(--theme-blue-line, #4f75ca); background: linear-gradient(135deg, var(--theme-blue-solid, #5268c6), var(--theme-blue-solid, #477dc9)); color: var(--theme-on-emphasis, #ffffff); }
 .market-futures-headline-stat { display: grid; min-width: 240px; max-width: 330px; gap: 2px; padding: 7px 11px; border: 1px solid var(--theme-blue-line, #bfd3ed); border-radius: 8px; background: var(--theme-surface-soft, #f5f9ff); }
-.market-futures-headline-stat span { color: var(--theme-muted, #587391); font-size: 11px; }
-.market-futures-headline-stat strong { color: var(--theme-blue, #1e5d9d); font-family: "SFMono-Regular", Consolas, monospace; font-size: 18px; line-height: 1.15; }
-.market-futures-headline-stat small { overflow: hidden; color: var(--theme-subtle, #8597ab); font-size: 10px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
+.market-futures-headline-stat span { color: var(--theme-muted, #587391); font-size: 16px; }
+.market-futures-headline-stat strong { color: var(--theme-blue, #1e5d9d); font-family: "SFMono-Regular", Consolas, monospace; font-size: 23px; line-height: 1.15; }
+.market-futures-headline-stat small { overflow: hidden; color: var(--theme-subtle, #8597ab); font-size: 15px; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
 .market-overview-hero .market-ai-button:hover { color: var(--theme-on-emphasis, #ffffff); filter: brightness(1.04); }
 
 .market-pulse-view { display: grid; gap: 10px; }
 .market-pulse-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
 .market-pulse-metrics > article { display: grid; grid-template-columns: 36px minmax(0, 1fr); align-items: center; gap: 9px; min-height: 72px; padding: 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--theme-surface, #ffffff); }
 .market-pulse-metrics i { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; background: var(--theme-blue-soft, #edf5ff); color: var(--theme-blue, #2476d2); font-style: normal; }
 .market-pulse-metrics article > span { display: grid; gap: 2px; min-width: 0; }
-.market-pulse-metrics small { color: var(--theme-muted, #7b8999); font-size: 11px; }
-.market-pulse-metrics strong { color: var(--theme-text, #26394f); font-family: "SFMono-Regular", Consolas, monospace; font-size: 17px; }
-.market-pulse-metrics em { overflow: hidden; color: var(--theme-subtle, #939eab); font-size: 10px; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
+.market-pulse-metrics small { color: var(--theme-muted, #7b8999); font-size: 16px; }
+.market-pulse-metrics strong { color: var(--theme-text, #26394f); font-family: "SFMono-Regular", Consolas, monospace; font-size: 22px; }
+.market-pulse-metric
```

---

### Incident Patch 3: `3bc0e5be` (2026-10-03)
**Commit Message**: fix: improve stock research evidence and recover stalled analysis

Unify trading-window returns and compare recent moves against business peer cohorts. Preserve theme provenance, recover announcement and financial evidence, and explain evidence limitations.

Track model response progress, retry bounded idle failures, and resume saved research stages. Align research report panels and move analysis mode navigation below the stock search.

**File**: `backend/internal/agent/codex.go` (modified, +10/-0)
```diff
@@ -484,18 +484,28 @@ func (r *CodexRuntime) PromptWithOptions(ctx context.Context, prompt string, opt
 		return e
 	}
 	result := PromptResult{Runtime: Codex}
+	watchdog := newPromptWatchdog(options)
+	defer watchdog.close()
 	for {
 		select {
 		case <-ctx.Done():
+			result.Progress = watchdog.snapshot()
 			return result, ctx.Err()
+		case <-watchdog.channel():
+			result.Progress = watchdog.snapshot()
+			return result, watchdog.timeout()
 		case f, ok := <-frames:
 			if !ok {
 				return result, errors.New("Codex 会话意外结束")
 			}
 			if f.Error != nil {
 				return result, errors.New(f.Error.Message)
 			}
+			watchdog.observe(f)
+			result.Progress = watchdog.snapshot()
 			switch eventType(f) {
+			case "message.delta":
+				result.Content += firstNonEmpty(eventText(f, "delta"), eventText(f, "text"))
 			case "gateway.ready":
 				err = send("create", "session.create", map[string]any{})
 			case "message.complete":
```

**File**: `backend/internal/agent/prompt_options.go` (modified, +5/-0)
```diff
@@ -8,6 +8,7 @@ import (
 	"path/filepath"
 	"strconv"
 	"strings"
+	"time"
 
 	"gopkg.in/yaml.v3"
 )
@@ -33,6 +34,10 @@ type PromptOptions struct {
 	DisableTools     bool
 	Toolsets         []string
 	BrowserStatePath string
+	// Zero leaves timing to the caller. Only actual model output resets idle time.
+	FirstResponseTimeout time.Duration
+	IdleTimeout          time.Duration
+	OnProgress           func(PromptProgress)
 }
 
 type OptionsPrompter interface {
```

**File**: `backend/internal/agent/prompt_progress.go` (added, +137/-0)
```diff
@@ -0,0 +1,137 @@
+package agent
+
+import (
+	"context"
+	"fmt"
+	"strings"
+	"time"
+)
+
+// Metrics deliberately omit model text and credentials.
+type PromptProgress struct {
+	Event           string `json:"event,omitempty"`
+	ElapsedMS       int64  `json:"elapsed_ms"`
+	FirstResponseMS int64  `json:"first_response_ms,omitempty"`
+	TextBytes       int    `json:"text_bytes"`
+	ReasoningBytes  int    `json:"reasoning_bytes"`
+	RetryCount      int    `json:"retry_count"`
+}
+
+type PromptTimeoutError struct {
+	Kind          string
+	Wait          time.Duration
+	Progress      PromptProgress
+	RuntimeDetail string
+}
+
+func (e *PromptTimeoutError) Error() string {
+	label := "等待模型首个有效响应"
+	if e.Kind == "idle" {
+		label = "模型持续无有效输出"
+	}
+	message := fmt.Sprintf("%s超过%d秒（已接收正文%d字节、思考%d字节、已观测重试%d次）", label, int(e.Wait.Seconds()), e.Progress.TextBytes, e.Progress.ReasoningBytes, e.Progress.RetryCount)
+	if e.RuntimeDetail != "" {
+		message += "；运行时详情：" + e.RuntimeDetail
+	}
+	return message
+}
+func (e *PromptTimeoutError) Unwrap() error { return context.DeadlineExceeded }
+
+type promptWatchdog struct {
+	options      PromptOptions
+	started      time.Time
+	timer        *time.Timer
+	kind         string
+	wait         time.Duration
+	received     bool
+	lastNotified time.Time
+	progress     PromptProgress
+	lastRetry    string
+}
+
+func newPromptWatchdog(options PromptOptions) *promptWatchdog {
+	w := &promptWatchdog{options: options, started: time.Now()}
+	w.reset("first_response", options.FirstResponseTimeout)
+	return w
+}
+func (w *promptWatchdog) reset(kind string, wait time.Duration) {
+	w.kind, w.wait = kind, wait
+	if wait <= 0 {
+		if w.timer != nil {
+			w.timer.Stop()
+			w.timer = nil
+		}
+		return
+	}
+	if w.timer == nil {
+		w.timer = time.NewTimer(wait)
+		return
+	}
+	if !w.timer.Stop() {
+		select {
+		case <-w.timer.C:
+		default:
+		}
+	}
+	w.timer.Reset(wait)
+}
+func (w *promptWatchdog) channel() <-chan time.Time {
+	if w.timer == nil {
+		return nil
+	}
+	return w.timer.C
+}
+func (w *promptWatchdog) close() {
+	if w.timer != nil {
+		w.timer.Stop()
+	}
+}
+func (w *promptWatchdog) snapshot() PromptProgress {
+	p := w.progress
+	p.ElapsedMS = time.Since(w.started).Milliseconds()
+	return p
+}
+func (w *promptWatchdog) timeout() error {
+	return &PromptTimeoutError{Kind: w.kind, Wait: w.wait, Progress: w.snapshot()}
+}
+func (w *promptWatchdog) observe(frame rpcFrame) {
+	event := eventType(frame)
+	text := firstNonEmpty(eventText(frame, "delta"), eventText(frame, "text"), eventText(frame, "content"))
+	active := false
+	retrying := false
+	switch event {
+	case "message.delta":
+		w.progress.TextBytes += len(text)
+		active = text != ""
+	case "reasoning.delta":
+		w.progress.ReasoningBytes += len(text)
+		active = text != ""
+	case "message.complete":
+		active = text != ""
+		if len(text) > w.progress.TextBytes {
+			w.progress.TextBytes = len(text)
+		}
+	case "notification.show", "status.update", "thinking.delta":
+		// Retry/wait notices are diagnostics, never evidence of generation.
+		status := firstNonEmpty(eventText(frame, "kind"), eventText(frame, "key")) + " " + text
+		lower := strings.ToLower(status)
+		if (strings.Contains(lower, "retry") || strings.Contains(lower, "重试")) && status != w.lastRetry {
+			w.lastRetry = status
+			w.progress.RetryCount++
+			w.progress.Event = "retry"
+			retrying = true
+		}
+	}
+	if active {
+		if !w.received {
+			w.received = true
+			w.progress.FirstResponseMS = time.Since(w.started).Milliseconds()
+		}
+		w.progress.Event = event
+		w.reset("idle", w.options.IdleTimeout)
+	}
+	if w.options.OnProgress != nil && (active || retrying) && (w.lastNotified.IsZero() || time.Since(w.lastNotified) >= 5*time.Second || retrying || event == "message.complete") {
+		w.lastNotified = time.Now()
+		w.options.OnProgress(w.snapshot())
+	}
+}
```

**File**: `backend/internal/agent/prompt_progress_test.go` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+package agent
+
+import (
+	"context"
+	"errors"
+	"os"
+	"path/filepath"
+	"runtime"
+	"strings"
+	"testing"
+	"time"
+)
+
+func progressFixture(t *testing.T, events string) *HermesRuntime {
+	t.Helper()
+	if runtime.GOOS == "windows" {
+		t.Skip("POSIX gateway fixture")
+	}
+	root := t.TempDir()
+	home := filepath.Join(root, "home")
+	if err := os.MkdirAll(home, 0700); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.WriteFile(filepath.Join(home, ".env"), []byte("MODEL_API_KEY=test-key\n"), 0600); err != nil {
+		t.Fatal(err)
+	}
+	launcher := filepath.Join(root, "gateway.sh")
+	script := `#!/bin/sh
+printf '%s\n' '{"method":"gateway.ready"}'
+IFS= read -r create
+printf '%s\n' '{"id":"1","result":{"session_id":"fixture"}}'
+IFS= read -r submit
+` + events
+	if err := os.WriteFile(launcher, []byte(script), 0700); err != nil {
+		t.Fatal(err)
+	}
+	r := NewHermesRuntime(HermesConfig{Home: home, WorkDir: root, PythonPath: launcher})
+	r.configured = true
+	r.reasoningResolved = map[string]ReasoningCapability{capabilityKey("", "") + "|": reasoningCapability("unknown", "", "fixture", "default", "default")}
+	return r
+}
+
+func TestPromptProgressKeepsActiveReasoningAlive(t *testing.T) {
+	r := progressFixture(t, `i=0
+while [ "$i" -lt 8 ]; do
+printf '%s\n' '{"method":"reasoning.delta","params":{"text":"thinking"}}'
+sleep 0.07
+i=$((i+1))
+done
+printf '%s\n' '{"method":"message.complete","params":{"content":"{\"ok\":true}"}}'
+`)
+	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
+	defer cancel()
+	result, err := r.PromptWithOptions(ctx, "test", PromptOptions{FirstResponseTimeout: time.Second, IdleTimeout: 300 * time.Millisecond})
+	if err != nil || result.Content != `{"ok":true}` || result.Progress.ReasoningBytes != 64 || result.Progress.ElapsedMS < 300 {
+		t.Fatalf("active generation interrupted or metrics lost: %+v %v", result, err)
+	}
+}
+
+func TestPromptProgressWaitingHintsDoNotResetFirstResponse(t *testing.T) {
+	r := progressFixture(t, `i=0
+while [ "$i" -lt 20 ]; do
+printf '%s\n' '{"method":"thinking.delta","params":{"text":"waiting"}}'
+sleep 0.03
+i=$((i+1))
+done
+`)
+	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
+	defer cancel()
+	result, err := r.PromptWithOptions(ctx, "test", PromptOptions{FirstResponseTimeout: 150 * time.Millisecond, IdleTimeout: time.Second})
+	var timeout *PromptTimeoutError
+	if !errors.As(err, &timeout) || !errors.Is(err, context.DeadlineExceeded) || timeout.Kind != "first_response" || result.Progress.ReasoningBytes != 0 {
+		t.Fatalf("waiting hints kept a stalled call alive: %+v %v", result, err)
+	}
+}
+
+func TestPromptProgressIdleTimeoutPreservesPartialOutput(t *testing.T) {
+	r := progressFixture(t, `printf '%s\n' '{"method":"reasoning.delta","params":{"text":"reasoning"}}'
+printf '%s\n' '{"method":"message.delta","params":{"text":"{\"part\":"}}'
+sleep 0.6
+`)
+	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
+	defer cancel()
+	result, err := r.PromptWithOptions(ctx, "test", PromptOptions{FirstResponseTimeout: time.Second, IdleTimeout: 150 * time.Millisecond})
+	var timeout *PromptTimeoutError
+	if !errors.As(err, &timeout) || timeout.Kind != "idle" || result.Content != `{"part":` || result.Progress.TextBytes == 0 || result.Progress.ReasoningBytes == 0 || !strings.Contains(err.Error(), "已接收正文") {
+		t.Fatalf("partial output discarded: %+v %v", result, err)
+	}
+}
+
+func TestPromptProgressTotalBudgetStillStopsActiveGeneration(t *testing.T) {
+	r := progressFixture(t, `while true; do
+printf '%s\n' '{"method":"reasoning.delta","params":{"text":"thinking"}}'
+sleep 0.03
+done
+`)
+	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
+	defer cancel()
+	result, err := r.PromptWithOptions(ctx, "test", PromptOptions{FirstResponseTimeout: 2 * time.Second, IdleTimeout: 2 * time.Second})
+	var timeout *PromptTimeoutError
+	if !errors.Is(err, context.DeadlineExceeded) || errors.As(err, &timeout) || result.Progress.ReasoningBytes == 0 {
+		t.Fatalf("total deadline lost: %+v %v", result, err)
+	}
+}
```

**File**: `backend/internal/agent/runtime.go` (modified, +37/-14)
```diff
@@ -55,6 +55,7 @@ type PromptResult struct {
 	SessionID       string
 	StoredSessionID string
 	Usage           TokenUsage
+	Progress        PromptProgress
 }
 
 type Process interface {
@@ -731,47 +732,69 @@ func (r *HermesRuntime) prompt(ctx context.Context, prompt, browserStatePath str
 	submitted := false
 	result := PromptResult{}
 	var streamed strings.Builder
+	watchdog := newPromptWatchdog(options)
+	defer watchdog.close()
+	failure := func(err error) (PromptResult, error) {
+		if result.Content == "" {
+			result.Content = streamed.String()
+		}
+		result.Progress = watchdog.snapshot()
+		return result, err
+	}
 	approvalSequence := 0
 	for {
 		select {
 		case <-ctx.Done():
-			return PromptResult{}, ctx.Err()
+			return failure(ctx.Err())
+		case <-watchdog.channel():
+			err := watchdog.timeout()
+			if timeout, ok := err.(*PromptTimeoutError); ok {
+				key, _ := r.ModelAPIKey()
+				detail := sanitizeHermesDiagnostic(diagnostics.String(), key)
+				if len(detail) > 1200 {
+					detail = detail[len(detail)-1200:]
+				}
+				timeout.RuntimeDetail = detail
+			}
+			return failure(err)
 		case item := <-lines:
 			if item.err != nil {
 				waitForDiagnostics(diagnosticsDone)
-				return PromptResult{}, r.hermesFailure(fmt.Sprintf("Hermes 会话结束: %v", item.err), diagnostics.String())
+				return failure(r.hermesFailure(fmt.Sprintf("Hermes 会话结束: %v", item.err), diagnostics.String()))
 			}
 			if len(item.line) == 0 {
 				waitForDiagnostics(diagnosticsDone)
-				return PromptResult{}, r.hermesFailure("Hermes 会话意外结束", diagnostics.String())
+				return failure(r.hermesFailure("Hermes 会话意外结束", diagnostics.String()))
 			}
 			var frame rpcFrame
 			if err := json.Unmarshal(item.line, &frame); err != nil {
 				continue
 			}
 			if frame.Error != nil {
-				return PromptResult{}, r.hermesFailure(fmt.Sprintf("Hermes: %s", frame.Error.Message), diagnostics.String())
+				return failure(r.hermesFailure(fmt.Sprintf("Hermes: %s", frame.Error.Message), diagnostics.String()))
 			}
+			watchdog.observe(frame)
+			result.Progress = watchdog.snapshot()
 			if usage := usageFromFrame(frame); usage.TotalTokens > 0 {
 				result.Usage = usage
 			}
 			if eventType(frame) == "gateway.ready" && !created {
 				created = true
 				sessionWorkDir := firstNonEmpty(processOptions.workDir, r.workDir)
 				if err := writeRPC("1", "session.create", map[string]any{"cwd": sessionWorkDir}); err != nil {
-					return PromptResult{}, err
+					return failure(err)
 				}
 				continue
 			}
 			if frame.ID == "1" && frame.Result != nil && !submitted {
 				result.SessionID = stringValue(frame.Result["session_id"])
 				result.StoredSessionID = firstNonEmpty(stringValue(frame.Result["stored_session_id"]), result.SessionID)
 				if result.SessionID == "" {
-					return PromptResult{}, errors.New("Hermes 未返回会话 ID")
+					return failure(errors.New("Hermes 未返回会话 ID"))
 				}
 				submitted = true
 				if err := writeRPC("2", "prompt.submit", map[string]any{"session_id": result.SessionID, "text": prompt}); err != nil {
-					return PromptResult{}, err
+					return failure(err)
 				}
 				continue
 			}
@@ -781,7 +804,7 @@ func (r *HermesRuntime) prompt(ctx context.Context, prompt, browserStatePath str
 					continue
 				}
 				if err := writeRPCResult(frame.ID, map[string]any{"choice": "session"}); err != nil {
-					return PromptResult{}, fmt.Errorf("Hermes 自动授权失败: %w", err)
+					return failure(fmt.Errorf("Hermes 自动授权失败: %w", err))
 				}
 			case "clarify":
 				// One-shot backend tasks have no interactive renderer. An empty answer
@@ -793,7 +816,7 @@ func (r *HermesRuntime) prompt(ctx context.Context, prompt, browserStatePath str
 						clarifyResult = map[string]any{"answers": map[string]string{}}
 					}
 					if err := writeRPCResult(frame.ID, clarifyResult); err != nil {
-						return PromptResult{}, fmt.Errorf("Hermes 澄清请求响应失败: %w", err)
+						return failure(fmt.Errorf("Hermes 澄清请求响应失败: %w", err))
 					}
 				}
 			case "approval.request":
@@ -803,27 +826,27 @@ func (r *HermesRuntime) prompt(ctx context.Context, prompt, browserStatePath str
 				approvalSequence++
 				sessionID := firstNonEmpty(stringValue(frame.Params["session_id"]), result.SessionID)
 				if sessionID == "" {
-					return PromptResult{}, errors.New("Hermes 自动授权请求缺少会话 ID")
+					return failure(errors.New("Hermes 自动授权请求缺少会话 ID"))
 				}
 				if err := writeRPC(fmt.Sprintf("approval-%d", approvalSequence), "approval.respond", map[string]any{
 					"session_id": sessionID,
 					"choice":     "session",
 				}); err != nil {
-					return PromptResult{}, fmt.Errorf("Hermes 自动授权失败: %w", err)
+					return failure(fmt.Errorf("Hermes 自动授权失败: %w", err))
 				}
 			case "message.delta":
 				streamed.WriteString(firstNonEmpty(eventText(frame, "delta"), eventText(frame, "text")))
 			case "message.complete":
 				result.Content = strings.TrimSpace(firstNonEmpty(eventText(frame, "content"), eventText(frame, "text"), streamed.String()))
 				if result.Content =
```

**File**: `backend/internal/agent/service.go` (modified, +14/-0)
```diff
@@ -322,6 +322,20 @@ func BoundModel(ctx context.Context) string {
 	return ""
 }
 
+// The bound configuration is copied at task start. Its digest includes the
+// reasoning policy, so a resumed research cannot silently mix configurations.
+func BoundConfigurationIdentity(ctx context.Context) string {
+	if binding, ok := ctx.Value(bindingKey{}).(*taskBinding); ok {
+		data, err := os.ReadFile(filepath.Join(binding.hermes.home, "config.yaml"))
+		if err != nil {
+			return binding.identity
+		}
+		hash := sha256.Sum256(data)
+		return binding.identity + ":" + hex.EncodeToString(hash[:])
+	}
+	return ""
+}
+
 func BoundStatus(ctx context.Context) (Status, bool) {
 	if binding, ok := ctx.Value(bindingKey{}).(*taskBinding); ok {
 		return binding.status, true
```

**File**: `backend/internal/foundation/types.go` (modified, +1/-0)
```diff
@@ -165,6 +165,7 @@ type StockBusinessProfile struct {
 // units: amounts are CNY and percentage fields are percentage points.
 type StockFundamentals struct {
 	Symbol                        string     `json:"symbol"`
+	PublishedAt                   time.Time  `json:"published_at,omitempty"`
 	ReportDate                    string     `json:"report_date"`
 	ReportName                    string     `json:"report_name"`
 	Revenue                       float64    `json:"revenue"`
```

**File**: `backend/internal/httpapi/config.go` (modified, +8/-0)
```diff
@@ -68,6 +68,14 @@ type StockBusinessProfileProvider interface {
 	StockFundamentals(ctx context.Context, symbol string) (foundation.StockFundamentals, error)
 }
 
+type StockFinancialHistoryProvider interface {
+	StockFinancialHistory(ctx context.Context, symbol string, limit int) ([]foundation.StockFundamentals, error)
+}
+
+type MarketAnnouncementContentProvider interface {
+	MarketAnnouncementContent(ctx context.Context, id string) (string, error)
+}
+
 type StockDirectoryProvider interface {
 	StockCatalog(ctx context.Context) ([]foundation.StockCatalogEntry, error)
 }
```

---

### Incident Patch 4: `37a8c1bb` (2026-09-30)
**Commit Message**: fix: keep reasoning effort labels readable on Windows

Python pipes decoded stdin with the ANSI code page (GBK on zh-CN),
mojibake-ing the UTF-8 labels passed to the reasoning describe bridge
and poisoning the 30-day capability cache. Force UTF-8 stdio in the
launcher, default PYTHONUTF8/PYTHONIOENCODING for managed Python child
processes, and bump the capability cache version to drop bad entries.

**File**: `backend/internal/agent/reasoning.go` (modified, +1/-1)
```diff
@@ -252,7 +252,7 @@ type capabilityCacheEntry struct {
 	Models        map[string]ReasoningCapability `json:"models"`
 }
 
-const reasoningCapabilityVersion = 4
+const reasoningCapabilityVersion = 5
 
 type CapabilityGateway interface {
 	ResolveModelCapabilities(baseURL, apiMode string, models map[string]json.RawMessage) (map[string]ReasoningCapability, error)
```

**File**: `backend/internal/agent/reasoning_launcher.py` (modified, +8/-0)
```diff
@@ -162,6 +162,14 @@ def supported(self, requested_model):
 
 
 def main():
+    # Windows pipes default stdio to the ANSI code page (GBK on zh-CN), but the
+    # Go host always writes UTF-8. Reconfigure before the first stdin read.
+    for stream in (sys.stdin, sys.stdout, sys.stderr):
+        if stream is not None and hasattr(stream, "reconfigure"):
+            try:
+                stream.reconfigure(encoding="utf-8")
+            except (OSError, ValueError):
+                pass
     if len(sys.argv) > 1 and sys.argv[1] == "describe":
         request = json.load(sys.stdin)
         result = {}
```

**File**: `backend/internal/agent/reasoning_launcher_test.py` (modified, +19/-0)
```diff
@@ -1,4 +1,8 @@
 """Integration tests against bundled Hermes transports; no network or SDK patches."""
+import json
+import os
+import subprocess
+import sys
 import unittest
 import reasoning_launcher as bridge
 from providers import get_provider_profile, register_provider
@@ -27,6 +31,21 @@ def request(self, effort, **overrides):
         transport = ResponsesApiTransport() if self.config['api_mode'] == 'codex_responses' else ChatCompletionsTransport()
         return transport.build_kwargs(self.config['model'], [{'role':'user','content':'hi'}], **params)
 
+    def test_describe_pipes_keep_utf8_chinese_labels(self):
+        # Windows pipes decode stdin with the ANSI code page (GBK) unless the
+        # launcher reconfigures stdio; the Go host always writes UTF-8.
+        request = {"config": {"model": "m", "base_url": "https://x.example/v1", "api_mode": "chat_completions"},
+                   "models": [{"model": "m", "supplement": {"options": [{"value": "low", "label": "低"}, {"value": "max", "label": "最大"}],
+                                                            "default": "max", "source": "official", "wire": "openai_chat"}}]}
+        env = {k: v for k, v in os.environ.items() if k not in ("PYTHONUTF8", "PYTHONIOENCODING")}
+        script = "import sys; sys.argv = ['reasoning_launcher', 'describe']; import reasoning_launcher; reasoning_launcher.main()"
+        run = subprocess.run([sys.executable, "-c", script], input=json.dumps(request).encode("utf-8"),
+                             capture_output=True, env=env,
+                             cwd=os.path.dirname(os.path.abspath(bridge.__file__)))
+        self.assertEqual(run.returncode, 0, run.stderr.decode("utf-8", "replace"))
+        labels = {o["value"]: o["label"] for o in json.loads(run.stdout.decode("utf-8"))["m"]["options"]}
+        self.assertEqual(labels, {"low": "低", "max": "最大"})
+
     def test_deepseek_alias_native_translation(self):
         self.assertEqual(self.configure('deepseek-chat', 'https://api.deepseek.com/v1'), ['none','low','medium','high','max'])
         body = self.request('max')
```

**File**: `backend/internal/agent/runtime.go` (modified, +9/-0)
```diff
@@ -1295,6 +1295,15 @@ func hermesEnvironment(base []string, home, workDir, binDir string) []string {
 	values = setEnv(values, "PYTHONNOUSERSITE", "1")
 	values = setEnv(values, "PYTHONUNBUFFERED", "1")
 	values = setEnv(values, "NO_COLOR", "1")
+	// Python stdio and pipes follow the ANSI code page on Windows (GBK on
+	// zh-CN) while this app speaks UTF-8. Same defaults hermes_bootstrap sets
+	// for its own children; an explicit user setting still wins.
+	if environmentValue(base, "PYTHONUTF8") == "" {
+		values = setEnv(values, "PYTHONUTF8", "1")
+	}
+	if environmentValue(base, "PYTHONIOENCODING") == "" {
+		values = setEnv(values, "PYTHONIOENCODING", "utf-8")
+	}
 	if strings.TrimSpace(home) != "" {
 		values = setEnv(values, "AGENT_BROWSER_PROFILE", filepath.Join(home, "browser-profile"))
 	}
```

**File**: `backend/internal/agent/runtime_test.go` (modified, +17/-0)
```diff
@@ -297,6 +297,23 @@ func TestHermesEnvironmentIncludesWorkspaceNodeBin(t *testing.T) {
 	}
 }
 
+func TestHermesEnvironmentDefaultsPythonToUTF8(t *testing.T) {
+	values := hermesEnvironment([]string{"PATH=/usr/bin"}, t.TempDir(), "", "")
+	if got := envValue(values, "PYTHONUTF8"); got != "1" {
+		t.Fatalf("PYTHONUTF8 = %q, want 1", got)
+	}
+	if got := envValue(values, "PYTHONIOENCODING"); got != "utf-8" {
+		t.Fatalf("PYTHONIOENCODING = %q, want utf-8", got)
+	}
+	values = hermesEnvironment([]string{"PATH=/usr/bin", "PYTHONUTF8=0", "PYTHONIOENCODING=gbk"}, t.TempDir(), "", "")
+	if got := envValue(values, "PYTHONUTF8"); got != "0" {
+		t.Fatalf("PYTHONUTF8 = %q, want user setting 0", got)
+	}
+	if got := envValue(values, "PYTHONIOENCODING"); got != "gbk" {
+		t.Fatalf("PYTHONIOENCODING = %q, want user setting gbk", got)
+	}
+}
+
 func TestRuntimePythonUsesStandaloneWindowsInterpreter(t *testing.T) {
 	root := filepath.Join("runtime", "hermes")
 	if got := runtimePythonForOS(root, "windows"); got != filepath.Join(root, "python", "python.exe") {
```

---

### Incident Patch 5: `73632da6` (2026-09-30)
**Commit Message**: fix: verify existing OSS uploads with native CRC64

**File**: `desktop/scripts/publish-updater-oss.sh` (modified, +19/-1)
```diff
@@ -30,13 +30,31 @@ if command -v timeout >/dev/null 2>&1; then
   upload_timeout=(timeout --kill-after=15s "${OSS_UPLOAD_TIMEOUT_SECONDS:-600}s")
 fi
 
+matches_public_file() {
+  local file=$1 name headers local_size remote_size remote_crc local_crc
+  name=$(basename "$file")
+  headers="$verification_root/existing-headers"
+  if ! curl --fail --silent --location --head --connect-timeout 10 --max-time 20 \
+    "${public_url%/}/$name" --dump-header "$headers" --output /dev/null; then return 1; fi
+  local_size=$(wc -c < "$file" | tr -d ' ')
+  remote_size=$(awk 'tolower($1) == "content-length:" { gsub("\r", "", $2); size=$2 } END { print size }' "$headers")
+  remote_crc=$(awk 'tolower($1) == "x-oss-hash-crc64ecma:" { gsub("\r", "", $2); crc=$2 } END { print crc }' "$headers")
+  [[ "$remote_size" == "$local_size" && -n "$remote_crc" ]] || return 1
+  local_crc=$("$ossutil_command" hash crc64 "$file" | awk 'NR == 1 { print $1 }') || return 1
+  [[ "$local_crc" == "$remote_crc" ]]
+}
+
 upload() {
   local file=$1 cache_control=$2 name attempt
   name=$(basename "$file")
+  if [[ "$cache_control" == 'public,max-age=31536000,immutable' ]] && matches_public_file "$file"; then
+    echo "Already published with matching size and OSS CRC64: $name"
+    return 0
+  fi
   for attempt in 1 2 3; do
     echo "Uploading $name (attempt $attempt/3)"
     if "${upload_timeout[@]}" "$ossutil_command" "${ossutil_options[@]}" cp "$file" "${target_uri%/}/$name" \
-      --force --checksum --no-progress --parallel "${OSS_UPLOAD_PARALLEL:-16}" --part-size 4Mi --checkpoint-dir "$verification_root/checkpoints" --cache-control "$cache_control"; then
+      --force --no-progress --parallel "${OSS_UPLOAD_PARALLEL:-16}" --part-size 4Mi --checkpoint-dir "$verification_root/checkpoints" --cache-control "$cache_control"; then
       return 0
     fi
   done
```

**File**: `desktop/test/release-publish.test.cjs` (modified, +8/-0)
```diff
@@ -67,6 +67,7 @@ test('OSS retries failed uploads and never advances manifests before public asse
     fs.writeFileSync(path.join(assets, metadata), `version: 1.3.0\nfiles:\n  - url: ${name}\n    sha512: ${crypto.createHash('sha512').update(bytes).digest('base64')}\n`);
   }
   fs.writeFileSync(path.join(bin, 'ossutil'), `#!/usr/bin/env bash
+if [[ "$1" == hash ]]; then echo "42  $3"; exit 0; fi
 while [[ "$1" != cp ]]; do shift; done
 name=$(basename "$2")
 echo "upload:$name" >> "$CHECK_ROOT/log"
@@ -88,6 +89,7 @@ if [[ "$head" == 1 ]]; then
   size=$(wc -c < "$CHECK_ROOT/assets/$name" | tr -d ' ')
   [[ "\${CORRUPT_SIZE:-0}" == 1 ]] && size=0
   printf 'HTTP/1.1 200 OK\\r\\nContent-Length: %s\\r\\n\\r\\n' "$size" > "$headers"
+  if [[ "\${MATCH_PUBLIC_CRC:-0}" == 1 ]]; then printf 'x-oss-hash-crc64ecma: 42\\r\\n' >> "$headers"; fi
 else cp "$CHECK_ROOT/assets/$name" "$output"; fi
 `, { mode: 0o755 });
   const publish = (extra = {}) => spawnSync('bash', [path.resolve(__dirname, '../scripts/publish-updater-oss.sh'), assets], {
@@ -102,4 +104,10 @@ else cp "$CHECK_ROOT/assets/$name" "$output"; fi
   const failure = publish({ CORRUPT_SIZE: '1' });
   assert.notEqual(failure.status, 0);
   assert.doesNotMatch(fs.readFileSync(path.join(root, 'log'), 'utf8'), /upload:latest/);
+  fs.writeFileSync(path.join(root, 'log'), '');
+  const resume = publish({ MATCH_PUBLIC_CRC: '1' });
+  assert.equal(resume.status, 0, resume.stderr);
+  const resumedLog = fs.readFileSync(path.join(root, 'log'), 'utf8');
+  assert.doesNotMatch(resumedLog, /upload:(mac\.zip|win\.exe)/);
+  assert.match(resumedLog, /upload:latest-mac\.yml/);
 });
```

---

### Incident Patch 6: `df5d57fd` (2026-09-30)
**Commit Message**: fix: size release disk images and preserve Windows MCP arguments

**File**: `backend/internal/agent/codex_test.go` (modified, +38/-0)
```diff
@@ -428,3 +428,41 @@ func TestBuiltinMCPHandshake(t *testing.T) {
 		t.Fatalf("MCP handshake: %v %s", err, data)
 	}
 }
+
+func TestMCPStdioLauncherPreservesArgumentsAndPipes(t *testing.T) {
+	python := os.Getenv("EASY_STOCK_HERMES_TEST_PYTHON")
+	if python == "" {
+		var err error
+		python, err = exec.LookPath("python3")
+		if err != nil {
+			t.Skip("Python is unavailable")
+		}
+	}
+	for _, subprocessLaunch := range []bool{false, true} {
+		t.Run(fmt.Sprintf("subprocess=%v", subprocessLaunch), func(t *testing.T) {
+			argument := "A path with spaces\nand a second line"
+			child := "import json,os,sys\nprint(json.dumps({'arg':sys.argv[1], 'line':sys.stdin.readline().strip(), 'model_key':os.getenv('OPENAI_API_KEY'), 'tool_key':os.getenv('FIXTURE_SECRET')}),flush=True)\n"
+			spec, _ := json.Marshal(map[string]any{"transport": "stdio", "command": python, "args": []string{"-c", child, argument}, "env": map[string]string{"FIXTURE_SECRET": "fixture-only"}})
+			launcher := mcpLauncher
+			if subprocessLaunch {
+				launcher = strings.Replace(launcher, "if os.name == 'nt':", "if True:", 1)
+			}
+			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
+			defer cancel()
+			cmd := exec.CommandContext(ctx, python, "-c", launcher, "EASY_STOCK_MCP_TEST")
+			cmd.Env = append(os.Environ(), "EASY_STOCK_MCP_TEST="+string(spec), "OPENAI_API_KEY=fixture-model-key")
+			cmd.Stdin = strings.NewReader("MCP input message\n")
+			output, err := cmd.CombinedOutput()
+			if err != nil {
+				t.Fatalf("stdio launcher failed: %v: %s", err, output)
+			}
+			var result map[string]any
+			if err := json.Unmarshal(output, &result); err != nil {
+				t.Fatalf("stdio output is not JSON: %v: %s", err, output)
+			}
+			if result["arg"] != argument || result["line"] != "MCP input message" || result["model_key"] != nil || result["tool_key"] != "fixture-only" {
+				t.Fatalf("stdio arguments, pipes or credential isolation failed: %v", result)
+			}
+		})
+	}
+}
```

**File**: `backend/internal/agent/mcp_launcher.py` (modified, +6/-0)
```diff
@@ -11,6 +11,12 @@
 os.environ.update(spec.get('env', {}))
 
 if spec['transport'] == 'stdio':
+    if os.name == 'nt':
+        # Windows execvpe does not quote arguments like subprocess does. Keep
+        # multiline scripts and paths with spaces intact, and inherit the MCP
+        # pipes while the launcher waits for the child process to finish.
+        import subprocess
+        raise SystemExit(subprocess.run([spec['command'], *spec.get('args', [])], env=os.environ).returncode)
     os.execvpe(spec['command'], [spec['command'], *spec.get('args', [])], os.environ)
 
 import anyio
```

**File**: `desktop/scripts/create-dmg.mjs` (modified, +4/-1)
```diff
@@ -3,6 +3,7 @@ import fs from 'node:fs';
 import os from 'node:os';
 import path from 'node:path';
 import { fileURLToPath } from 'node:url';
+import { dmgSizeMiB } from './dmg-size.mjs';
 
 const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
 const arch = process.env.A_STOCK_DESKTOP_ARCH || process.arch;
@@ -35,7 +36,9 @@ try {
 	// framework symlinks to absolute paths. Create a writable volume first and
 	// copy into the mounted filesystem with `ditto`, which preserves the
 	// relative links required by Electron frameworks.
-	run('hdiutil', ['create', '-size', '1200m', '-fs', 'Journaled HFS+', '-volname', 'easy-stock', '-ov', '-type', 'UDIF', writableImagePath]);
+	const imageSizeMiB = dmgSizeMiB(appPath);
+	console.log(`Creating ${imageSizeMiB} MiB writable image for the bundled application`);
+	run('hdiutil', ['create', '-size', `${imageSizeMiB}m`, '-fs', 'Journaled HFS+', '-volname', 'easy-stock', '-ov', '-type', 'UDIF', writableImagePath]);
 	run('hdiutil', ['attach', writableImagePath, '-nobrowse', '-mountpoint', writableMountPath]);
 	writableMounted = true;
 	const stagedAppPath = path.join(writableMountPath, 'easy-stock.app');
```

**File**: `desktop/scripts/dmg-size.mjs` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import fs from 'node:fs';
+import path from 'node:path';
+
+export function dmgSizeMiB(appPath) {
+  let bytes = 0;
+  function walk(root) {
+    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
+      const file = path.join(root, entry.name);
+      bytes += 16384; // Allow space for filesystem entries and extended attributes.
+      if (entry.isDirectory()) walk(file);
+      else if (entry.isFile()) bytes += fs.statSync(file).size;
+    }
+  }
+  walk(appPath);
+  return Math.max(1200, Math.ceil(bytes / 1024 / 1024 * 1.2) + 128);
+}
```

**File**: `desktop/test/release-publish.test.cjs` (modified, +15/-0)
```diff
@@ -6,6 +6,21 @@ const path = require('node:path');
 const { spawnSync } = require('node:child_process');
 const test = require('node:test');
 
+test('DMG capacity grows with bundled runtime files', async (t) => {
+  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'easy-stock-dmg-size-'));
+  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
+  const { dmgSizeMiB } = await import('../scripts/dmg-size.mjs');
+  assert.equal(dmgSizeMiB(root), 1200);
+  const file = fs.openSync(path.join(root, 'large-runtime'), 'w');
+  fs.ftruncateSync(file, 1500 * 1024 * 1024);
+  fs.closeSync(file);
+  assert.ok(dmgSizeMiB(root) > 1500 + 128);
+  if (process.platform !== 'win32') {
+    fs.symlinkSync(root, path.join(root, 'external-link'));
+    assert.ok(dmgSizeMiB(root) < 2000, 'symlinks must not duplicate target contents');
+  }
+});
+
 test('GitHub publication rejects incomplete or corrupted remote assets', (t) => {
   const root = fs.mkdtempSync(path.join(os.tmpdir(), 'easy-stock-publish-check-'));
   t.after(() => fs.rmSync(root, { recursive: true, force: true }));
```

---

### Incident Patch 7: `b3d7ea5b` (2026-09-30)
**Commit Message**: fix: close settings after save and show success notice

**File**: `frontend/src/App.tsx` (modified, +10/-1)
```diff
@@ -5,6 +5,7 @@ import {
 	BookMarked,
 	BookOpen,
 	BrainCircuit,
+	CheckCircle2,
 	ChevronDown,
 	ChevronRight,
 	Clock3,
@@ -136,8 +137,15 @@ export function App() {
 	const [aiPrefill, setAIPrefill] = useState('');
 	const [aiAnalysisID, setAIAnalysisID] = useState<string | undefined>();
 	const [settingsOpen, setSettingsOpen] = useState(false);
+	const [settingsSavedNotice, setSettingsSavedNotice] = useState(0);
 	const [tokenUsageRefreshKey, setTokenUsageRefreshKey] = useState(0);
 
+	useEffect(() => {
+		if (!settingsSavedNotice) return;
+		const timer = window.setTimeout(() => setSettingsSavedNotice(0), 3000);
+		return () => window.clearTimeout(timer);
+	}, [settingsSavedNotice]);
+
 	const overview = useThemeOverview(config, workspaceMode === 'themes');
 	const themeOverviews = overview.data;
 	const overviewMeta = overview.meta;
@@ -697,7 +705,8 @@ export function App() {
 					<div><Radio size={15} aria-hidden="true" /><span>{workspaceMode === 'themes' ? '题材与龙一至龙五：开盘啦 · 实时行情：新浪 · K线与领导力：东方财富/新浪' : workspaceMode === 'limit-up' ? '当日涨停池与逐股题材：开盘啦优先 · 历史梯队、缺失股票与行情字段：东方财富补充 · 默认剔除ST' : workspaceMode === 'mastery' ? '来源：trading-mastery/游资心法 · 每日缓存 · 同步至 Agent Skill 与本地记忆索引' : workspaceMode === 'reviews' ? '复盘文章：本地 SQLite 归档 · 原文观点不代表系统结论' : workspaceMode === 'stock-ai' ? '行情与K线：东方财富/新浪 · 涨停与题材：开盘啦/东方财富 · AI只基于结构化证据总结' : workspaceMode === 'portfolio-inspection' ? '逐股分析复用个股引擎 · 组合指标由本地程序计算 · AI只基于结构化证据汇总' : workspaceMode === 'market' ? '行情与行业强度：腾讯/东方财富 · 资金与领涨标的：新浪/东方财富 · 龙虎榜、公告与研报：东方财富 · 盘面快讯：财联社 · AI 只读取带时间和来源的证据' : workspaceMode === 'token-usage' ? '真实用量来自模型返回的 usage · 本地估算单独记录，不并入真实总量' : '模型请求由本地后端转发 · API Key 不会暴露给页面 · 对话历史保存在当前设备'}</span></div>
 			</footer>
 			</div>
-			<SettingsDrawer config={config} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => { setAIRefreshKey((current) => current + 1); setStockAIRefreshKey((current) => current + 1); }} />
+			<SettingsDrawer config={config} open={settingsOpen} onClose={() => setSettingsOpen(false)} onSaved={() => { setSettingsSavedNotice((current) => current + 1); setAIRefreshKey((current) => current + 1); setStockAIRefreshKey((current) => current + 1); }} />
+			{settingsSavedNotice > 0 && <div className="settings-save-notice" role="status"><CheckCircle2 size={22} aria-hidden="true" /><span>保存成功</span></div>}
 		</main>
 	);
 }
```

**File**: `frontend/src/components/SettingsDrawer.tsx` (modified, +4/-3)
```diff
@@ -442,11 +442,12 @@ export function SettingsDrawer({ config, open, onClose, onSaved }: Props) {
 		try {
 			await persistSettings();
 			setState('saved');
-			setMessage('共享设置已保存');
+			setMessage('保存成功');
 			onSaved?.();
+			onClose();
 		} catch (error) {
 			setState('error');
-			setMessage(error instanceof Error ? error.message : '保存设置失败');
+			setMessage(error instanceof Error && error.message ? `保存失败：${error.message}` : '保存失败');
 		}
 	};
 
@@ -569,7 +570,7 @@ export function SettingsDrawer({ config, open, onClose, onSaved }: Props) {
 						</SettingsSection>
 
 						<footer className="settings-footer">
-							<div className={`settings-message ${state}`}>{state === 'saved' && <CheckCircle2 size={15} />}{state === 'error' && <KeyRound size={15} />}<span>{message || '留空的模型密钥会保留已保存的值。'}</span></div>
+							<div className={`settings-message ${state}`} role={state === 'error' ? 'alert' : 'status'}>{state === 'saved' && <CheckCircle2 size={15} />}{state === 'error' && <CircleAlert size={15} />}<span>{message || '留空的模型密钥会保留已保存的值。'}</span></div>
 							<button type="button" onClick={onClose}>取消</button>
 							<button type="submit" className="settings-save" disabled={!config || state === 'saving' || testState === 'testing'}>{state === 'saving' ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}保存设置</button>
 						</footer>
```

**File**: `frontend/src/styles.css` (modified, +19/-0)
```diff
@@ -3707,6 +3707,25 @@ a:focus-visible {
 .settings-message.saved { color: var(--theme-green, #167653); }
 .settings-message.error { color: var(--theme-red, #bc303a); }
 .settings-message span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
+.settings-save-notice {
+	position: fixed;
+	top: 50%;
+	left: 50%;
+	transform: translate(-50%, -50%);
+	z-index: 1300;
+	display: flex;
+	align-items: center;
+	gap: 10px;
+	padding: 18px 28px;
+	border: 1px solid var(--theme-green-line, #b9ded0);
+	border-radius: 12px;
+	background: var(--theme-surface, #ffffff);
+	box-shadow: 0 12px 30px var(--theme-shadow, rgba(23, 46, 72, .16));
+	color: var(--theme-green, #167653);
+	font-size: 16px;
+	font-weight: 600;
+	pointer-events: none;
+}
 
 .app-update-status { display: grid; gap: 11px; padding: 13px; border: 1px solid var(--theme-line, #cfe0f2); border-radius: 10px; background: var(--theme-surface-soft, #f7faff); }
 .app-update-status.downloaded { border-color: var(--theme-green-line, #b9dfd0); background: var(--theme-surface-soft, #f1fbf7); }
```

---

### Incident Patch 8: `e8f6e417` (2026-09-30)
**Commit Message**: fix: remove the AI chat workspace topbar

**File**: `frontend/src/App.tsx` (modified, +2/-2)
```diff
@@ -410,7 +410,7 @@ export function App() {
 				</div>
 			</aside>
 			<div className="app-shell">
-			<div className={`workspace-topbar ${workspaceMode !== 'stock-ai' ? `collapsible ${topbarExpanded ? 'expanded' : ''}` : ''}`}>
+			{workspaceMode !== 'ai' && <div className={`workspace-topbar ${workspaceMode !== 'stock-ai' ? `collapsible ${topbarExpanded ? 'expanded' : ''}` : ''}`}>
 				{workspaceMode !== 'stock-ai' && <button
 					type="button"
 					className="topbar-toggle"
@@ -446,7 +446,7 @@ export function App() {
 					</button>
 				</div>
 			</header>
-			</div>
+			</div>}
 
 			{workspaceMode === 'token-usage' ? <TokenUsageWorkspace config={config} refreshKey={tokenUsageRefreshKey} /> : workspaceMode === 'themes' ? <>
 			<section className="market-strip" aria-label="市场概览">
```

**File**: `frontend/src/styles.css` (modified, +2/-2)
```diff
@@ -5098,7 +5098,7 @@ a:focus-visible {
 .ai-chat-workspace {
 	display: grid;
 	grid-template-columns: 250px minmax(0, 1fr);
-	min-height: calc(100vh - 150px);
+	min-height: calc(100vh - 80px);
 	max-width: 1840px;
 	margin: 0 auto;
 	border: 1px solid var(--line);
@@ -5621,7 +5621,7 @@ a:focus-visible {
 }
 
 @media (max-width: 760px) {
-	.ai-chat-workspace { grid-template-columns: 1fr; min-height: calc(100vh - 118px); }
+	.ai-chat-workspace { grid-template-columns: 1fr; min-height: calc(100vh - 80px); }
 	.ai-thread-rail { grid-template-rows: auto auto; border-right: 0; border-bottom: 1px solid var(--line); }
 	.ai-thread-list { display: flex; overflow-x: auto; }
 	.ai-thread-list > button { flex: 0 0 190px; }
```

---

### Incident Patch 9: `874ac8d1` (2026-09-30)
**Commit Message**: fix: improve chat scrolling and simplify workspace layout

**File**: `frontend/src/App.tsx` (modified, +23/-16)
```diff
@@ -5,6 +5,7 @@ import {
 	BookMarked,
 	BookOpen,
 	BrainCircuit,
+	ChevronDown,
 	ChevronRight,
 	Clock3,
 	Database,
@@ -99,6 +100,7 @@ export function App() {
 		return 'themes';
 	});
 	const [sidebarExpanded, setSidebarExpanded] = useState(true);
+	const [topbarExpanded, setTopbarExpanded] = useState(true);
 	const [config, setConfig] = useState<BackendConfig | null>(null);
 	const [themeStrengthWindow, setThemeStrengthWindow] = useState<ThemeStrengthWindow>('daily');
 	const [activeTheme, setActiveTheme] = useState('');
@@ -319,6 +321,7 @@ export function App() {
 	};
 
 	const switchWorkspace = (mode: WorkspaceMode) => {
+		if (mode !== workspaceMode) setTopbarExpanded(true);
 		setWorkspaceMode(mode);
 		window.history.replaceState(null, '', mode === 'limit-up' ? '#limit-up' : mode === 'mastery' ? '#mastery' : mode === 'reviews' ? '#reviews' : mode === 'stock-ai' ? '#stock-ai' : mode === 'portfolio-inspection' ? '#portfolio-inspection' : mode === 'ai' ? '#ai' : mode === 'market' ? '#market/pulse' : mode === 'token-usage' ? '#token-usage' : '#themes');
 	};
@@ -384,10 +387,10 @@ export function App() {
 		? limitUpData ? `${limitUpData.current.trade_date} · ${limitUpData.session_status} · ${limitUpData.meta.source.includes('duanxianxia') ? '开盘啦涨停池' : '东方财富兜底'} · ${limitUpData.concept_status === 'ready' ? '题材已归因' : limitUpState === 'loading' ? '题材补充中' : '题材暂不完整'}` : '开盘啦涨停池优先'
 		: workspaceMode === 'mastery' ? 'GitHub 原始资料 · 每日缓存 · Agent 本地知识库' : workspaceMode === 'reviews' ? '雪球 · 淘股吧 · 微信公众号' : workspaceMode === 'stock-ai' ? '多周期评分 · 基准超额 · 隔日情景 · 动态风控' : workspaceMode === 'portfolio-inspection' ? '逐股分析 · 组合风险 · 后台任务' : workspaceMode === 'ai' ? '本机 Agent AI 对话' : workspaceMode === 'market' ? '全球指数 · 行业资金 · 龙虎榜 · 公告研报' : workspaceMode === 'token-usage' ? '模型输入、输出与功能模块消耗' : themeSourceStatus + ' · ' + streamStatus;
 	const topbarTitle = workspaceMode === 'themes' ? '趋势题材雷达' : workspaceMode === 'limit-up' ? '短线连板雷达' : workspaceMode === 'mastery' ? '游资心法库' : workspaceMode === 'reviews' ? '大V复盘日记' : workspaceMode === 'stock-ai' ? '个股 AI 分析' : workspaceMode === 'portfolio-inspection' ? '持仓 AI 巡检' : workspaceMode === 'market' ? '行情总览' : workspaceMode === 'token-usage' ? 'Token 统计' : 'AI 对话';
-	const topbarDescription = workspaceMode === 'themes' ? '炒作主线、趋势强度、个股梯队与日 K 联动工作台' : workspaceMode === 'limit-up' ? '连板高度、炒作概念与晋级结构工作台' : workspaceMode === 'mastery' ? '阅读不同游资的交易经验，并由 Agent 按原文辅助研读' : workspaceMode === 'reviews' ? '多平台复盘内容、作者观点与原文归档工作台' : workspaceMode === 'stock-ai' ? '多周期评分、隔日情景推演与账户级风控执行工作台' : workspaceMode === 'portfolio-inspection' ? '逐股研判、集中度识别与组合风险巡检工作台' : workspaceMode === 'market' ? '从盘面快讯到资金与研究信号的统一行情工作台' : workspaceMode === 'token-usage' ? '按日、按月和功能模块查看模型 Token 消耗' : '像 Codex 一样持续协作、拆解问题并形成可执行结果';
+	const topbarDescription = workspaceMode === 'themes' ? '炒作主线、趋势强度、个股梯队与日 K 联动工作台' : workspaceMode === 'limit-up' ? '连板高度、炒作概念与晋级结构工作台' : workspaceMode === 'mastery' ? '阅读不同游资的交易经验，并由 Agent 按原文辅助研读' : workspaceMode === 'reviews' ? '多平台复盘内容、作者观点与原文归档工作台' : workspaceMode === 'stock-ai' ? '多周期评分、隔日情景推演与账户级风控执行工作台' : workspaceMode === 'portfolio-inspection' ? '逐股研判、集中度识别与组合风险巡检工作台' : workspaceMode === 'market' ? '从盘面快讯到资金与研究信号的统一行情工作台' : workspaceMode === 'token-usage' ? '按日、按月和功能模块查看模型 Token 消耗' : '';
 
 	return (
-		<main className={`workspace-frame ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
+		<main className={`workspace-frame ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'} ${workspaceMode === 'ai' ? 'workspace-ai' : ''}`}>
 			<aside className="app-sidebar" aria-label="功能导航">
 				<div className="sidebar-brand"><div className="sidebar-logo"><img src={`${import.meta.env.BASE_URL}easy-stock-mark.svg`} alt="easy-stock" /></div>{sidebarExpanded && <div><strong>easy-stock</strong><span>AI STOCK LAB</span></div>}</div>
 				<nav>
@@ -407,26 +410,29 @@ export function App() {
 				</div>
 			</aside>
 			<div className="app-shell">
-			<header className="topbar">
+			{workspaceMode !== 'ai' && <div className={`workspace-topbar ${workspaceMode !== 'stock-ai' ? `collapsible ${topbarExpanded ? 'expanded' : ''}` : ''}`}>
+				{workspaceMode !== 'stock-ai' && <button
+					type="button"
+					className="topbar-toggle"
+					onClick={() => setTopbarExpanded((value) => !value)}
+					aria-expanded={topbarExpanded}
+					aria-controls="workspace-topbar-content"
+					aria-label={topbarExpanded ? '收起顶部栏' : '展开顶部栏'}
+					title={topbarExpanded ? '收起顶部栏' : '展开顶部栏'}
+				><ChevronDown size={16} aria-hidden="true" /></button>}
+			<header id="workspace-topbar-content" className={workspaceMode === 'stock-ai' ? 'topbar topbar-with-modes' : 'topbar'} hidden={workspaceMode !== 'stock-ai' && !topbarExpanded}>
 				<div className="brand-block">
 					<div className="brand-mark"><img src={`${import.meta.env.BASE_URL}easy-stock-mark.svg`} alt="easy-stock" /></div>
 					<div>
 						<h1>{topbarTitle}</h1>
-						<p>{topbarDescription}</p>
+						{topbarDescription && <p>{topbarDescripti
```

**File**: `frontend/src/components/AIChatWorkspace.tsx` (modified, +8/-24)
```diff
@@ -15,7 +15,7 @@ import {
 } from 'lucide-react';
 import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import { AppSettings, BackendConfig, LLMModelOption, LLMModelsResult, LLMProfile, requestJSON } from '../lib/backend';
-import { llmProviderDefaultModel, llmProviderName } from '../lib/llm-providers';
+import { llmProviderDefaultModel } from '../lib/llm-providers';
 import {
 	ChatConversation,
 	ChatMessage,
@@ -78,7 +78,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 	const [draft, setDraft] = useState('');
 	const [sending, setSending] = useState(false);
 	const [modelState, setModelState] = useState<ModelState>('loading');
-	const [modelLabel, setModelLabel] = useState('读取模型配置');
 	const [llmConfig, setLLMConfig] = useState<ChatLLMConfig | null>(null);
 	const [llmProfiles, setLLMProfiles] = useState<LLMProfile[]>([]);
 	const [activeLLMProfileID, setActiveLLMProfileID] = useState('');
@@ -98,7 +97,7 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 	const [clarifyDraft, setClarifyDraft] = useState('');
 	const abortRef = useRef<AbortController | null>(null);
 	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
-	const messageEndRef = useRef<HTMLDivElement | null>(null);
+	const messageStageRef = useRef<HTMLDivElement | null>(null);
 	const modelMessageTimerRef = useRef<number | null>(null);
 
 	const activeConversation = useMemo(
@@ -120,7 +119,8 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 	}, [conversations]);
 
 	useEffect(() => {
-		messageEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
+		const stage = messageStageRef.current;
+		stage?.scrollTo({ top: stage.scrollHeight, behavior: 'smooth' });
 	}, [activeConversation?.messages.length, sending]);
 
 	useEffect(() => {
@@ -146,7 +146,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 	const loadModel = useCallback(async () => {
 		if (!config) {
 			setModelState('error');
-			setModelLabel('后端尚未连接');
 			setLLMConfig(null);
 			setModelOptions([]);
 			setModelListState('error');
@@ -172,9 +171,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 			const usable = agent.available && agent.configured;
 			setLLMConfig(nextLLM);
 			setModelState(usable ? 'ready' : agent.available ? 'missing' : 'error');
-			setModelLabel(usable
-				? `${payload.data.agent_runtime === 'codex' ? 'Codex' : 'Hermes'} · ${llmProviderName(provider)} · ${model}`
-				: agent.message || (agent.available ? '需要配置 Agent 模型' : 'Agent 运行时不可用'));
 
 			try {
 				const models = await requestChatModels(config, nextLLM, payload.data.active_llm_profile_id || profiles[0]?.id || '');
@@ -188,11 +184,10 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 			}
 		} catch (error) {
 			setModelState('error');
-			setModelLabel(error instanceof Error ? error.message : '模型配置读取失败');
 			setLLMConfig(null);
 			setModelOptions([]);
 			setModelListState('error');
-			setModelListMessage('模型配置读取失败');
+			setModelListMessage(error instanceof Error ? error.message : '模型配置读取失败');
 		}
 	}, [config]);
 
@@ -239,7 +234,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 			setConversations((current) => clearAgentSessionIDs(current));
 			const usable = payload.data.agent.available && payload.data.agent.configured;
 			setModelState(usable ? 'ready' : payload.data.agent.available ? 'missing' : 'error');
-			setModelLabel(usable ? `${payload.data.agent_runtime === 'codex' ? 'Codex' : 'Hermes'} · ${llmProviderName(active.provider)} · ${active.model}` : payload.data.agent.message || '需要配置 Agent 模型');
 			setModelSwitchState('saved');
 			setModelSwitchMessage(`已切换为 ${profile.name}，下一条消息生效`);
 			window.setTimeout(() => { setModelSwitchState('idle'); setModelSwitchMessage(''); }, 3500);
@@ -266,9 +260,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
 			setConversations((current) => clearAgentSessionIDs(current));
 			const usable = agent.available && agent.configured;
 			setModelState(usable ? 'ready' : agent.available ? 'missing' : 'error');
-			setModelLabel(usable
-				? `${payload.data.agent_runtime === 'codex' ? 'Codex' : 'Hermes'} · ${llmProviderName(llm.provider)} · ${llm.model}`
-				: agent.message || (agent.available ? '需要配置 Agent 模型' : 'Agent 运行时不可用'));
 			setModelSwitchState('saved');
 			setModelSwitchMessage(`已切换为 ${llm.model}，下一条消息生效`);
 			modelMessageTimerRef.current = window.setTimeout(() => {
@@ -369,7 +360,6 @@ export function AIChatWorkspace({ config, refreshKey, initialPrompt, initialAnal
             setAgentRuntime(runtime);
             setLLMConfig(latest.llm);
             setActiveLLMProfileID(latest.active_llm_profile_id);
-            setModelLabel(`${runtime === 'codex' ? 'Codex' : 'Hermes'} · ${llm
```

**File**: `frontend/src/styles.css` (modified, +81/-52)
```diff
@@ -706,15 +706,57 @@ a:focus-visible {
 	.token-usage-stat > strong { font-size: 21px; }
 }
 
+.workspace-topbar { display: contents; }
+
+.workspace-topbar.collapsible {
+	display: grid;
+	width: 100%;
+	max-width: 1840px;
+	margin: 0 auto 10px;
+}
+
+.workspace-topbar.collapsible .topbar {
+	width: 100%;
+	margin: 10px 0 0;
+}
+
+.topbar[hidden] { display: none; }
+
+.topbar-toggle {
+	display: grid;
+	place-items: center;
+	justify-self: center;
+	width: 48px;
+	height: 20px;
+	padding: 0;
+	border: 1px solid var(--line);
+	border-radius: 6px;
+	background: var(--surface);
+	color: var(--muted);
+	cursor: pointer;
+}
+
+.topbar-toggle:hover {
+	border-color: var(--theme-blue-line, #395879);
+	background: var(--surface-2);
+	color: var(--blue);
+}
+
+.workspace-topbar.expanded .topbar-toggle svg { transform: rotate(180deg); }
+
 .topbar {
 	display: grid;
-	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
+	grid-template-columns: minmax(260px, 1fr) auto;
 	align-items: center;
 	gap: 22px;
 	max-width: 1840px;
 	margin: 0 auto 14px;
 }
 
+.topbar-with-modes {
+	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
+}
+
 .brand-block,
 .top-actions,
 .data-status,
@@ -5057,10 +5099,29 @@ a:focus-visible {
 }
 
 /* Codex-inspired AI conversation workspace. */
+.workspace-frame.workspace-ai {
+	height: 100dvh;
+	min-height: 0;
+	overflow: hidden;
+}
+
+.workspace-ai > .app-shell {
+	display: grid;
+	grid-template-rows: minmax(0, 1fr) auto;
+	min-height: 0;
+	overflow: hidden;
+}
+
+.workspace-ai > .app-sidebar { height: 100%; }
+.workspace-ai .topbar,
+.workspace-ai .data-footer { width: 100%; }
+
 .ai-chat-workspace {
 	display: grid;
 	grid-template-columns: 250px minmax(0, 1fr);
-	min-height: calc(100vh - 150px);
+	grid-template-rows: minmax(0, 1fr);
+	min-height: 0;
+	width: 100%;
 	max-width: 1840px;
 	margin: 0 auto;
 	border: 1px solid var(--line);
@@ -5072,8 +5133,10 @@ a:focus-visible {
 
 .ai-thread-rail {
 	display: grid;
-	grid-template-rows: auto minmax(0, 1fr) auto;
+	grid-template-rows: auto minmax(0, 1fr);
 	min-width: 0;
+	min-height: 0;
+	overflow: hidden;
 	border-right: 1px solid var(--line);
 	background: var(--theme-surface-soft, #f7f9fc);
 }
@@ -5108,7 +5171,10 @@ a:focus-visible {
 	align-content: start;
 	gap: 4px;
 	padding: 9px;
+	min-height: 0;
 	overflow-y: auto;
+	overscroll-behavior: contain;
+	scrollbar-gutter: stable;
 }
 
 .ai-thread-list > button {
@@ -5155,58 +5221,17 @@ a:focus-visible {
 	font-size: 11px;
 }
 
-.ai-local-note {
-	display: grid;
-	grid-template-columns: 10px minmax(0, 1fr);
-	align-items: start;
-	gap: 8px;
-	margin: 9px;
-	padding: 10px;
-	border: 1px solid var(--line-soft);
-	border-radius: 8px;
-	background: var(--theme-surface, #ffffff);
-}
-.ai-local-note .status-dot { margin-top: 4px; }
-.ai-local-note .status-dot.ready { background: var(--theme-green-solid, #1a9a6d); box-shadow: 0 0 0 3px var(--theme-shadow, rgba(26, 154, 109, 0.12)); }
-.ai-local-note .status-dot.missing,
-.ai-local-note .status-dot.error { background: var(--theme-amber-solid, #d08a20); box-shadow: 0 0 0 3px var(--theme-shadow, rgba(208, 138, 32, 0.12)); }
-.ai-local-note > div { display: grid; min-width: 0; gap: 3px; }
-.ai-local-note strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
-.ai-local-note small { color: var(--subtle); font-size: 11px; line-height: 1.4; }
-
 .ai-conversation-panel {
 	display: grid;
-	grid-template-rows: auto minmax(0, 1fr) auto;
+	grid-template-rows: minmax(0, 1fr) auto;
 	min-width: 0;
 	min-height: 0;
 	background: var(--theme-surface, #ffffff);
 }
 
-.ai-conversation-header {
-	display: grid;
-	grid-template-columns: 38px minmax(0, 1fr);
-	align-items: center;
-	gap: 10px;
-	min-height: 68px;
-	padding: 12px 18px;
-	border-bottom: 1px solid var(--line-soft);
-}
-.ai-assistant-avatar {
-	display: grid;
-	place-items: center;
-	width: 38px;
-	height: 38px;
-	border: 1px solid var(--theme-blue-line, #bfd5ec);
-	border-radius: 10px;
-	background: linear-gradient(145deg, var(--theme-surface-soft, #f6fbff), var(--theme-blue-soft, #e7f2fd));
-	color: var(--blue);
-}
-.ai-conversation-header > div:nth-child(2) { display: grid; min-width: 0; gap: 3px; }
-.ai-conversation-header strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
-.ai-conversation-header span { color: var(--subtle); font-size: 12px; }
-.ai-conversation-header span.ready { color: var(--theme-green, #167653); }
-.ai-conversation-header span.missing,
-.ai-conversation-header span.error { color: var(--theme-amber, #b9770e); }
+.ai-model-switch-notice { width: min(900px, 100%); margin: 0; color: var(--subtle); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
+.ai-model-switch-notice.saved { color: var(--theme-green, #167653); }
+.ai-model-switch-notice.error { color: var(--theme-amber, #b9770e); }
 .ai-conversation-tools {
 	display: flex;
 	align-items: center;
@@ -5338,6
```

---

### Incident Patch 10: `38038e33` (2026-09-30)
**Commit Message**: fix: simplify workspace topbars and expand them by default

**File**: `frontend/src/App.tsx` (modified, +16/-23)
```diff
@@ -100,7 +100,7 @@ export function App() {
 		return 'themes';
 	});
 	const [sidebarExpanded, setSidebarExpanded] = useState(true);
-	const [aiTopbarExpanded, setAITopbarExpanded] = useState(false);
+	const [topbarExpanded, setTopbarExpanded] = useState(true);
 	const [config, setConfig] = useState<BackendConfig | null>(null);
 	const [themeStrengthWindow, setThemeStrengthWindow] = useState<ThemeStrengthWindow>('daily');
 	const [activeTheme, setActiveTheme] = useState('');
@@ -321,7 +321,7 @@ export function App() {
 	};
 
 	const switchWorkspace = (mode: WorkspaceMode) => {
-		if (mode === 'ai' && workspaceMode !== 'ai') setAITopbarExpanded(false);
+		if (mode !== workspaceMode) setTopbarExpanded(true);
 		setWorkspaceMode(mode);
 		window.history.replaceState(null, '', mode === 'limit-up' ? '#limit-up' : mode === 'mastery' ? '#mastery' : mode === 'reviews' ? '#reviews' : mode === 'stock-ai' ? '#stock-ai' : mode === 'portfolio-inspection' ? '#portfolio-inspection' : mode === 'ai' ? '#ai' : mode === 'market' ? '#market/pulse' : mode === 'token-usage' ? '#token-usage' : '#themes');
 	};
@@ -387,7 +387,7 @@ export function App() {
 		? limitUpData ? `${limitUpData.current.trade_date} · ${limitUpData.session_status} · ${limitUpData.meta.source.includes('duanxianxia') ? '开盘啦涨停池' : '东方财富兜底'} · ${limitUpData.concept_status === 'ready' ? '题材已归因' : limitUpState === 'loading' ? '题材补充中' : '题材暂不完整'}` : '开盘啦涨停池优先'
 		: workspaceMode === 'mastery' ? 'GitHub 原始资料 · 每日缓存 · Hermes 本地知识库' : workspaceMode === 'reviews' ? '雪球 · 淘股吧 · 微信公众号' : workspaceMode === 'stock-ai' ? '多周期评分 · 基准超额 · 隔日情景 · 动态风控' : workspaceMode === 'portfolio-inspection' ? '逐股分析 · 组合风险 · 后台任务' : workspaceMode === 'ai' ? '本机 Hermes AI 对话' : workspaceMode === 'market' ? '全球指数 · 行业资金 · 龙虎榜 · 公告研报' : workspaceMode === 'token-usage' ? '模型输入、输出与功能模块消耗' : themeSourceStatus + ' · ' + streamStatus;
 	const topbarTitle = workspaceMode === 'themes' ? '趋势题材雷达' : workspaceMode === 'limit-up' ? '短线连板雷达' : workspaceMode === 'mastery' ? '游资心法库' : workspaceMode === 'reviews' ? '大V复盘日记' : workspaceMode === 'stock-ai' ? '个股 AI 分析' : workspaceMode === 'portfolio-inspection' ? '持仓 AI 巡检' : workspaceMode === 'market' ? '行情总览' : workspaceMode === 'token-usage' ? 'Token 统计' : 'AI 对话';
-	const topbarDescription = workspaceMode === 'themes' ? '炒作主线、趋势强度、个股梯队与日 K 联动工作台' : workspaceMode === 'limit-up' ? '连板高度、炒作概念与晋级结构工作台' : workspaceMode === 'mastery' ? '阅读不同游资的交易经验，并由 Hermes 按原文辅助研读' : workspaceMode === 'reviews' ? '多平台复盘内容、作者观点与原文归档工作台' : workspaceMode === 'stock-ai' ? '多周期评分、隔日情景推演与账户级风控执行工作台' : workspaceMode === 'portfolio-inspection' ? '逐股研判、集中度识别与组合风险巡检工作台' : workspaceMode === 'market' ? '从盘面快讯到资金与研究信号的统一行情工作台' : workspaceMode === 'token-usage' ? '按日、按月和功能模块查看模型 Token 消耗' : '像 Codex 一样持续协作、拆解问题并形成可执行结果';
+	const topbarDescription = workspaceMode === 'themes' ? '炒作主线、趋势强度、个股梯队与日 K 联动工作台' : workspaceMode === 'limit-up' ? '连板高度、炒作概念与晋级结构工作台' : workspaceMode === 'mastery' ? '阅读不同游资的交易经验，并由 Hermes 按原文辅助研读' : workspaceMode === 'reviews' ? '多平台复盘内容、作者观点与原文归档工作台' : workspaceMode === 'stock-ai' ? '多周期评分、隔日情景推演与账户级风控执行工作台' : workspaceMode === 'portfolio-inspection' ? '逐股研判、集中度识别与组合风险巡检工作台' : workspaceMode === 'market' ? '从盘面快讯到资金与研究信号的统一行情工作台' : workspaceMode === 'token-usage' ? '按日、按月和功能模块查看模型 Token 消耗' : '';
 
 	return (
 		<main className={`workspace-frame ${sidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
@@ -410,36 +410,29 @@ export function App() {
 				</div>
 			</aside>
 			<div className="app-shell">
-			<div className={`workspace-topbar ${workspaceMode === 'ai' ? `collapsible ${aiTopbarExpanded ? 'expanded' : ''}` : ''}`}>
-				{workspaceMode === 'ai' && <button
+			<div className={`workspace-topbar ${workspaceMode !== 'stock-ai' ? `collapsible ${topbarExpanded ? 'expanded' : ''}` : ''}`}>
+				{workspaceMode !== 'stock-ai' && <button
 					type="button"
 					className="topbar-toggle"
-					onClick={() => setAITopbarExpanded((value) => !value)}
-					aria-expanded={aiTopbarExpanded}
+					onClick={() => setTopbarExpanded((value) => !value)}
+					aria-expanded={topbarExpanded}
 					aria-controls="workspace-topbar-content"
-					aria-label={aiTopbarExpanded ? '收起顶部栏' : '展开顶部栏'}
-					title={aiTopbarExpanded ? '收起顶部栏' : '展开顶部栏'}
+					aria-label={topbarExpanded ? '收起顶部栏' : '展开顶部栏'}
+					title={topbarExpanded ? '收起顶部栏' : '展开顶部栏'}
 				><ChevronDown size={16} aria-hidden="true" /></button>}
-			<header id="workspace-topbar-content" className="topbar" hidden={workspaceMode === 'ai' && !aiTopbarExpanded}>
+			<header id="workspace-topbar-content" className={workspaceMode === 'stock-ai' ? 'topbar topbar-with-modes' : 'topbar'} hidden={workspaceMode !== 'stock-ai' && !topbarExpanded}>
 				<div className="brand-block">
 					<div className="brand-mark"><img src={`${import.meta.env.BASE_URL}easy-stock-mark.svg`} alt="easy-stock" /></div>
 					<div>
 						<h1>{topbarTitle}</h1>
-						<p>{topbarDescription}</p>
+						{topbarDescription && <p>{topbarDescription
```

**File**: `frontend/src/styles.css` (modified, +5/-1)
```diff
@@ -746,13 +746,17 @@ a:focus-visible {
 
 .topbar {
 	display: grid;
-	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
+	grid-template-columns: minmax(260px, 1fr) auto;
 	align-items: center;
 	gap: 22px;
 	max-width: 1840px;
 	margin: 0 auto 14px;
 }
 
+.topbar-with-modes {
+	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
+}
+
 .brand-block,
 .top-actions,
 .data-status,
```

---

### Incident Patch 11: `a07af29c` (2026-09-30)
**Commit Message**: fix: collapse AI chat topbar by default

**File**: `frontend/src/App.tsx` (modified, +15/-1)
```diff
@@ -5,6 +5,7 @@ import {
 	BookMarked,
 	BookOpen,
 	BrainCircuit,
+	ChevronDown,
 	ChevronRight,
 	Clock3,
 	Database,
@@ -99,6 +100,7 @@ export function App() {
 		return 'themes';
 	});
 	const [sidebarExpanded, setSidebarExpanded] = useState(true);
+	const [aiTopbarExpanded, setAITopbarExpanded] = useState(false);
 	const [config, setConfig] = useState<BackendConfig | null>(null);
 	const [themeStrengthWindow, setThemeStrengthWindow] = useState<ThemeStrengthWindow>('daily');
 	const [activeTheme, setActiveTheme] = useState('');
@@ -319,6 +321,7 @@ export function App() {
 	};
 
 	const switchWorkspace = (mode: WorkspaceMode) => {
+		if (mode === 'ai' && workspaceMode !== 'ai') setAITopbarExpanded(false);
 		setWorkspaceMode(mode);
 		window.history.replaceState(null, '', mode === 'limit-up' ? '#limit-up' : mode === 'mastery' ? '#mastery' : mode === 'reviews' ? '#reviews' : mode === 'stock-ai' ? '#stock-ai' : mode === 'portfolio-inspection' ? '#portfolio-inspection' : mode === 'ai' ? '#ai' : mode === 'market' ? '#market/pulse' : mode === 'token-usage' ? '#token-usage' : '#themes');
 	};
@@ -407,7 +410,17 @@ export function App() {
 				</div>
 			</aside>
 			<div className="app-shell">
-			<header className="topbar">
+			<div className={`workspace-topbar ${workspaceMode === 'ai' ? `collapsible ${aiTopbarExpanded ? 'expanded' : ''}` : ''}`}>
+				{workspaceMode === 'ai' && <button
+					type="button"
+					className="topbar-toggle"
+					onClick={() => setAITopbarExpanded((value) => !value)}
+					aria-expanded={aiTopbarExpanded}
+					aria-controls="workspace-topbar-content"
+					aria-label={aiTopbarExpanded ? '收起顶部栏' : '展开顶部栏'}
+					title={aiTopbarExpanded ? '收起顶部栏' : '展开顶部栏'}
+				><ChevronDown size={16} aria-hidden="true" /></button>}
+			<header id="workspace-topbar-content" className="topbar" hidden={workspaceMode === 'ai' && !aiTopbarExpanded}>
 				<div className="brand-block">
 					<div className="brand-mark"><img src={`${import.meta.env.BASE_URL}easy-stock-mark.svg`} alt="easy-stock" /></div>
 					<div>
@@ -440,6 +453,7 @@ export function App() {
 					</button>
 				</div>
 			</header>
+			</div>
 
 			{workspaceMode === 'token-usage' ? <TokenUsageWorkspace config={config} refreshKey={tokenUsageRefreshKey} /> : workspaceMode === 'themes' ? <>
 			<section className="market-strip" aria-label="市场概览">
```

**File**: `frontend/src/styles.css` (modified, +38/-0)
```diff
@@ -706,6 +706,44 @@ a:focus-visible {
 	.token-usage-stat > strong { font-size: 21px; }
 }
 
+.workspace-topbar { display: contents; }
+
+.workspace-topbar.collapsible {
+	display: grid;
+	width: 100%;
+	max-width: 1840px;
+	margin: 0 auto 10px;
+}
+
+.workspace-topbar.collapsible .topbar {
+	width: 100%;
+	margin: 10px 0 0;
+}
+
+.topbar[hidden] { display: none; }
+
+.topbar-toggle {
+	display: grid;
+	place-items: center;
+	justify-self: center;
+	width: 48px;
+	height: 20px;
+	padding: 0;
+	border: 1px solid var(--line);
+	border-radius: 6px;
+	background: var(--surface);
+	color: var(--muted);
+	cursor: pointer;
+}
+
+.topbar-toggle:hover {
+	border-color: var(--theme-blue-line, #395879);
+	background: var(--surface-2);
+	color: var(--blue);
+}
+
+.workspace-topbar.expanded .topbar-toggle svg { transform: rotate(180deg); }
+
 .topbar {
 	display: grid;
 	grid-template-columns: minmax(260px, 1fr) auto minmax(280px, 1fr);
```

---

### Incident Patch 12: `f8b5e1f3` (2026-09-29)
**Commit Message**: fix: improve stock and portfolio report readability

**File**: `frontend/src/styles.css` (modified, +69/-53)
```diff
@@ -252,24 +252,24 @@
 .portfolio-progress-bar i { display: block; height: 100%; border-radius: inherit; background: var(--theme-blue-solid, #3486ad); transition: width .25s ease; }
 .portfolio-progress-bar small { position: absolute; top: -17px; right: 0; color: var(--theme-muted, #6c7d89); font-size: 11px; }
 
-.portfolio-report { display: grid; gap: 13px; }
+.portfolio-report { display: grid; gap: 16px; min-width: 0; container: portfolio-report / inline-size; }
 .portfolio-report-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 16px 2px 12px; border-bottom: 1px solid var(--theme-line, #dce2e6); }
 .portfolio-report-header > div { display: grid; gap: 5px; }
 .portfolio-report-header span { display: flex; align-items: center; gap: 6px; color: var(--theme-blue, #2b769c); font-size: 12px; font-weight: 700; }
 .portfolio-report-header h2 { margin: 0; color: var(--theme-text, #1f3443); font-size: 21px; letter-spacing: 0; }
-.portfolio-report-header p { margin: 0; color: var(--theme-muted, #83909a); font-size: 12px; }
+.portfolio-report-header p { margin: 0; color: var(--theme-muted, #83909a); font-size: 13px; line-height: 1.6; }
 .portfolio-report-overview { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--theme-line, #d9e1e6); border-radius: 6px; background: var(--theme-surface, #fff); }
 .portfolio-report-overview > div { display: grid; gap: 5px; min-height: 92px; padding: 14px; border-right: 1px solid var(--theme-line-soft, #e4e9ec); }
 .portfolio-report-overview > div:last-child { border-right: 0; }
-.portfolio-report-overview span { color: var(--theme-muted, #7d8b96); font-size: 12px; }
+.portfolio-report-overview span { color: var(--theme-muted, #7d8b96); font-size: 13px; }
 .portfolio-report-overview strong { color: var(--theme-text, #263e4e); font-size: 20px; }
-.portfolio-report-overview small { color: var(--theme-subtle, #8a98a2); font-size: 11px; }
+.portfolio-report-overview small { color: var(--theme-subtle, #8a98a2); font-size: 12px; line-height: 1.6; }
 .portfolio-health-score { background: var(--theme-surface-soft, #edf7f2); }
 .portfolio-health-score strong { color: var(--theme-green, #25704e); font-size: 29px; }
 
 .portfolio-executive { padding: 16px 18px; border-left: 4px solid var(--theme-blue-line, #2c769b); background: var(--theme-surface, #fff); }
 .portfolio-executive h3 { margin: 0 0 7px; color: var(--theme-text, #203747); font-size: 12px; }
-.portfolio-executive p { margin: 0; color: var(--theme-muted, #526675); font-size: 13px; line-height: 1.8; }
+.portfolio-executive p { margin: 0; color: var(--theme-muted, #526675); font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; }
 .portfolio-report-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
 .portfolio-report-grid > section,
 .portfolio-limitations { padding: 14px 16px; border: 1px solid var(--theme-line, #dce3e7); border-radius: 6px; background: var(--theme-surface, #fff); }
@@ -278,41 +278,55 @@
 .portfolio-limitations > strong { font-size: 12px; }
 .portfolio-report-grid ul,
 .portfolio-report-grid ol,
-.portfolio-limitations ul { display: grid; gap: 6px; margin: 0; padding-left: 18px; color: var(--theme-muted, #586c7a); font-size: 10px; line-height: 1.6; }
-.portfolio-list-empty { margin: 0; color: var(--theme-subtle, #8b98a2); font-size: 10px; }
+.portfolio-limitations ul { display: grid; gap: 8px; margin: 0; padding-left: 22px; color: var(--theme-muted, #586c7a); font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; }
+.portfolio-list-empty { margin: 0; color: var(--theme-subtle, #8b98a2); font-size: 14px; line-height: 1.75; }
 
 .portfolio-holding-report { border-top: 1px solid var(--theme-line, #dce2e6); border-bottom: 1px solid var(--theme-line, #dce2e6); padding: 14px 0; }
-.portfolio-holding-report > header { display: flex; justify-content: space-between; margin-bottom: 9px; }
+.portfolio-holding-report > header { display: flex; align-items: baseline; flex-wrap: wrap; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
 .portfolio-holding-report > header strong { color: var(--theme-text, #263c4c); font-size: 12px; }
-.portfolio-holding-report > header small { color: var(--theme-subtle, #8996a0); font-size: 10px; }
-.portfolio-holding-report > div { display: grid; gap: 8px; }
-.portfolio-holding-report article { padding: 13px 15px; border: 1px solid var(--theme-line, #dce3e7); border-radius: 6px; background: var(--theme-surface, #fff); }
+.portfolio-holding-report > header small { color: var(--theme-subtle, #8996a0); font-size: 12px; }
+.portfolio-holding-report > div { display: grid; gap: 12px; }
+.portfolio-holding-report article { min-width: 0; padding: 16px 18px; border: 1px solid var(--theme-line, #dce3e7); border-radius: 6px; background: var(--theme-surface, #fff); }
 .portfolio-holding-report article > header { display: grid; grid-template-columns: minmax(0, 1fr) au
```

---

### Incident Patch 13: `14e82daf` (2026-09-29)
**Commit Message**: fix: enlarge body text while preserving list and heading sizes

**File**: `desktop/review-login-preload.cjs` (modified, +10/-4)
```diff
@@ -26,6 +26,9 @@ function mountLoginCompleteControl() {
         bottom: 24px;
         z-index: 2147483647;
         display: flex;
+        flex-wrap: wrap;
+        box-sizing: border-box;
+        max-width: calc(100vw - 48px);
         align-items: center;
         gap: 12px;
         padding: 12px 12px 12px 16px;
@@ -37,18 +40,21 @@ function mountLoginCompleteControl() {
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         backdrop-filter: blur(12px);
       }
-      .copy { display: grid; gap: 3px; min-width: 190px; }
+      .copy { display: grid; flex: 1 1 190px; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
       strong { font-size: 13px; line-height: 1.2; }
-      small { color: #77879a; font-size: 11px; line-height: 1.35; }
+      small { color: #77879a; font-size: 13px; line-height: 1.35; }
       button {
         min-width: 128px;
-        height: 40px;
+        min-height: 40px;
+        flex-shrink: 0;
+        margin-left: auto;
+        white-space: nowrap;
         padding: 0 16px;
         border: 0;
         border-radius: 10px;
         background: #1677e8;
         color: #fff;
-        font: 650 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
+        font: 650 15px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         cursor: pointer;
         box-shadow: 0 6px 16px rgba(22, 119, 232, .24);
       }
```

**File**: `desktop/xueqiu-login-preload.cjs` (modified, +10/-4)
```diff
@@ -14,6 +14,9 @@ function mountLoginCompleteControl() {
         bottom: 24px;
         z-index: 2147483647;
         display: flex;
+        flex-wrap: wrap;
+        box-sizing: border-box;
+        max-width: calc(100vw - 48px);
         align-items: center;
         gap: 12px;
         padding: 12px 12px 12px 16px;
@@ -25,18 +28,21 @@ function mountLoginCompleteControl() {
         font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         backdrop-filter: blur(12px);
       }
-      .copy { display: grid; gap: 3px; min-width: 190px; }
+      .copy { display: grid; flex: 1 1 190px; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
       strong { font-size: 13px; line-height: 1.2; }
-      small { color: #77879a; font-size: 11px; line-height: 1.35; }
+      small { color: #77879a; font-size: 13px; line-height: 1.35; }
       button {
         min-width: 128px;
-        height: 40px;
+        min-height: 40px;
+        flex-shrink: 0;
+        margin-left: auto;
+        white-space: nowrap;
         padding: 0 16px;
         border: 0;
         border-radius: 10px;
         background: #1677e8;
         color: #fff;
-        font: 650 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
+        font: 650 15px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         cursor: pointer;
         box-shadow: 0 6px 16px rgba(22, 119, 232, .24);
       }
```

**File**: `frontend/src/components/KLineChart.tsx` (modified, +2/-2)
```diff
@@ -63,8 +63,8 @@ export function KLineChart({ lines, symbol, state = 'ready', mode = 'daily', per
 	const sorted = [...lines].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
 	const width = 960;
 	const height = 430;
-	const left = 52;
-	const right = 72;
+	const left = 68;
+	const right = 84;
 	const chartTop = 20;
 	const chartBottom = 316;
 	const volumeTop = 338;
```

**File**: `frontend/src/components/stock-research.css` (modified, +23/-20)
```diff
@@ -1,12 +1,12 @@
-.stock-research-options { display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding:10px 0; color:var(--theme-text, #4b535b); font-size:12px; }
+.stock-research-options { display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding:10px 0; color:var(--theme-text, #4b535b); font-size:14px; }
 .stock-research-options [role=group] { display:flex; border:1px solid var(--theme-line, #d9dce1); border-radius:5px; overflow:hidden; }
 .stock-research-options button { min-height:32px; padding:6px 12px; border:0; background:var(--theme-surface, #fff); color:var(--theme-text, #4b535b); }
 .stock-research-options button.active { background:var(--theme-surface-soft, #e4f1eb); color:var(--theme-text, #176345); font-weight:600; }
 .stock-research-options label { display:flex; gap:8px; align-items:center; }
 .stock-research-options select,.stock-research-options input { min-height:32px; max-width:140px; border:1px solid var(--theme-line, #d9dce1); border-radius:4px; background:var(--theme-surface, white); padding:4px 8px; }
-.stock-research-progress { display:flex; gap:9px; align-items:center; min-height:40px; background:var(--theme-surface-soft, #edf4ef); color:var(--theme-text, #285d43); padding:9px 12px; font-size:12px; border-left:3px solid var(--theme-green-line, #398b60); }
+.stock-research-progress { display:flex; gap:9px; align-items:center; min-height:40px; background:var(--theme-surface-soft, #edf4ef); color:var(--theme-text, #285d43); padding:9px 12px; font-size:14px; border-left:3px solid var(--theme-green-line, #398b60); }
 .stock-research-progress-message { flex:1; min-width:0; overflow-wrap:anywhere; }
-.stock-research-progress-elapsed { flex:0 0 auto; color:inherit; font-size:13px; font-variant-numeric:tabular-nums; white-space:nowrap; }
+.stock-research-progress-elapsed { flex:0 0 auto; color:inherit; font-size:15px; font-variant-numeric:tabular-nums; white-space:nowrap; }
 .stock-research-progress button { display:grid; place-items:center; width:30px; height:30px; border:1px solid var(--theme-line, #c9d5cd); border-radius:4px; background:var(--theme-surface, white); }
 .stock-research-progress.degraded,.stock-research-progress.failed,.stock-research-progress.interrupted,.stock-research-progress.cancelled { background:var(--theme-amber-soft, #f7f1e7); border-color:var(--theme-amber-line, #ad852e); color:var(--theme-amber, #756020); }
 .stock-research-history { padding:6px 0 12px; }
@@ -19,14 +19,17 @@
 .stock-research-history time { color:var(--theme-muted, #757a80); font-size:10px; }
 .stock-research-history article span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--theme-muted, #747a81); }
 .stock-research-history article>button:last-child { background:transparent; border:0; width:26px; flex-shrink:0; color:var(--theme-muted, #6b727b); }
-.stock-research-report { min-width:0; background:var(--theme-surface, white); color:var(--theme-text, #30363c); font-size:15px; line-height:1.7; }
+.stock-research-report { min-width:0; background:var(--theme-surface, white); color:var(--theme-text, #30363c); font-size:17px; line-height:1.7; }
 .stock-research-report * { box-sizing:border-box; letter-spacing:0; }
 .stock-research-report p { margin:6px 0; overflow-wrap:anywhere; }
 .stock-research-report h3 { font-size:24px; margin:6px 0 14px; line-height:1.4; }
 .stock-research-report h4 { font-size:17px; margin:0 0 13px; color:var(--theme-text, #20282f); }
 .stock-research-report-header { display:flex; flex-wrap:wrap; gap:10px; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid var(--theme-line-soft, #e4e6e8); }
 .stock-research-report-header>div:first-child { display:flex; gap:14px; align-items:center; flex-wrap:wrap; }
-.stock-research-report-header span { font-size:13px; color:var(--theme-muted, #68716b); }
+.stock-research-report-header span { font-size:15px; color:var(--theme-muted, #68716b); }
+.stock-research-report-header strong,
+.stock-research-positions>div>strong,
+.stock-research-scenarios article>strong { font-size:15px; }
 .stock-research-report [role=tablist] { display:flex; gap:2px; }
 .stock-research-report [role=tab] { padding:7px 14px; border:0; background:transparent; border-bottom:2px solid transparent; color:var(--theme-muted, #626a70); }
 .stock-research-report [role=tab][aria-selected=true] { color:var(--theme-text, #176345); border-bottom-color:var(--theme-green-line, #27885d); }
@@ -38,44 +41,44 @@
 .stock-research-arguments section:first-child h4 { color:var(--theme-green, #277048); }
 .stock-research-arguments section:last-child h4 { color:var(--theme-red, #a24d43); }
 .stock-research-claim { padding:8px 0 12px; border-bottom:1px solid var(--theme-line-soft, #f0f1f2); }
-.stock-research-claim>span { font-size:12px; color:var(--theme-muted, #7c8389); }
+.stock-research-claim>span { font-size:14px; color:var(--theme-muted, #7c8389); }
 .stock-research-claim>div { display:flex; flex-wrap:
```

---

### Incident Patch 14: `bd47fc3d` (2026-09-26)
**Commit Message**: fix: default DeepSeek model to deepseek-v4-pro after V4 rename

**File**: `backend/internal/hermes/reasoning_test.go` (modified, +2/-2)
```diff
@@ -157,11 +157,11 @@ func TestBundledReasoningBridge(t *testing.T) {
 		t.Skip("set HERMES_TEST_PYTHON to the bundled runtime Python")
 	}
 	r := NewRuntime(Config{Home: t.TempDir(), PythonPath: python})
-	caps, err := r.ResolveModelCapabilities("https://api.deepseek.com/v1", "chat_completions", map[string]json.RawMessage{"deepseek-chat": nil})
+	caps, err := r.ResolveModelCapabilities("https://api.deepseek.com/v1", "chat_completions", map[string]json.RawMessage{"deepseek-v4-pro": nil})
 	if err != nil {
 		t.Fatal(err)
 	}
-	c := caps["deepseek-chat"]
+	c := caps["deepseek-v4-pro"]
 	if c.Source != "hermes" || c.Profile != "deepseek" || !c.Allows("max") || c.Allows("xhigh") {
 		t.Fatalf("native bridge: %+v", c)
 	}
```

**File**: `backend/internal/hermes/runtime.go` (modified, +1/-1)
```diff
@@ -1252,7 +1252,7 @@ func defaultBaseURL(provider string) string {
 func defaultModel(provider string) string {
 	switch provider {
 	case "deepseek":
-		return "deepseek-chat"
+		return "deepseek-v4-pro"
 	case "qwen":
 		return "qwen-plus"
 	case "moonshot":
```

**File**: `backend/internal/hermes/runtime_test.go` (modified, +3/-3)
```diff
@@ -24,7 +24,7 @@ func TestRuntimeSyncLLMWritesHermesConfigAndKeepsSecretInEnv(t *testing.T) {
 	home := filepath.Join(root, "hermes-home")
 	runtime := NewRuntime(Config{RuntimeRoot: root, Home: home, WorkDir: root, PythonPath: python})
 	key := "sk-hermes-private"
-	if err := runtime.SyncLLM(appsettings.LLM{Provider: "deepseek", BaseURL: "https://api.deepseek.com", Model: "deepseek-chat", APIMode: "chat_completions"}, &key); err != nil {
+	if err := runtime.SyncLLM(appsettings.LLM{Provider: "deepseek", BaseURL: "https://api.deepseek.com", Model: "deepseek-v4-pro", APIMode: "chat_completions"}, &key); err != nil {
 		t.Fatal(err)
 	}
 
@@ -40,13 +40,13 @@ func TestRuntimeSyncLLMWritesHermesConfigAndKeepsSecretInEnv(t *testing.T) {
 	model, _ := stringMap(config["model"])
 	providers, _ := stringMap(config["providers"])
 	provider, _ := stringMap(providers[providerSlug])
-	if stringValue(model["provider"]) != providerSlug || stringValue(model["default"]) != "deepseek-chat" || stringValue(provider["transport"]) != "chat_completions" || intValue(provider["stale_timeout_seconds"]) != appsettings.DefaultLLMResponseTimeoutSeconds {
+	if stringValue(model["provider"]) != providerSlug || stringValue(model["default"]) != "deepseek-v4-pro" || stringValue(provider["transport"]) != "chat_completions" || intValue(provider["stale_timeout_seconds"]) != appsettings.DefaultLLMResponseTimeoutSeconds {
 		t.Fatalf("unexpected Hermes config:\n%s", configText)
 	}
 	if timeout, err := readEnvValue(filepath.Join(home, ".env"), staleTimeoutEnvName); err != nil || timeout != strconv.Itoa(appsettings.DefaultLLMResponseTimeoutSeconds) {
 		t.Fatalf("initial stale timeout env = %q, %v; want %d", timeout, err, appsettings.DefaultLLMResponseTimeoutSeconds)
 	}
-	if err := runtime.SyncLLM(appsettings.LLM{Provider: "deepseek", BaseURL: "https://api.deepseek.com", Model: "deepseek-chat", APIMode: "chat_completions", ResponseTimeoutSeconds: 600}, nil); err != nil {
+	if err := runtime.SyncLLM(appsettings.LLM{Provider: "deepseek", BaseURL: "https://api.deepseek.com", Model: "deepseek-v4-pro", APIMode: "chat_completions", ResponseTimeoutSeconds: 600}, nil); err != nil {
 		t.Fatal(err)
 	}
 	configData, err = os.ReadFile(filepath.Join(home, "config.yaml"))
```

**File**: `backend/internal/httpapi/settings_test.go` (modified, +3/-3)
```diff
@@ -24,7 +24,7 @@ func TestSettingsAPIStoresSecretsWithoutReturningThem(t *testing.T) {
 	gateway := &fakeHermesGateway{status: hermes.Status{Available: true}}
 	server := NewServer(Config{SettingsStore: store, HermesGateway: gateway})
 	body := `{
-		"llm":{"provider":"deepseek","base_url":"https://api.deepseek.com","model":"deepseek-chat","api_mode":"chat_completions","api_key":"sk-private-12345678"},
+		"llm":{"provider":"deepseek","base_url":"https://api.deepseek.com","model":"deepseek-v4-pro","api_mode":"chat_completions","api_key":"sk-private-12345678"},
 		"credentials":{"tushare_token":"tushare-private-87654321"}
 	}`
 	req := httptest.NewRequest(http.MethodPut, "/api/v1/settings", strings.NewReader(body))
@@ -227,7 +227,7 @@ func TestSettingsAPISupportsMultipleLLMProfilesAndSelection(t *testing.T) {
 	runtime := hermes.NewRuntime(hermes.Config{Home: filepath.Join(root, "hermes"), PythonPath: python})
 	server := NewServer(Config{SettingsStore: store, HermesGateway: runtime})
 	body := `{"llm_profiles":[
-		{"id":"deepseek","name":"DeepSeek","provider":"deepseek","base_url":"https://api.deepseek.com","model":"deepseek-chat","api_mode":"chat_completions","api_key":"ds-private"},
+		{"id":"deepseek","name":"DeepSeek","provider":"deepseek","base_url":"https://api.deepseek.com","model":"deepseek-v4-pro","api_mode":"chat_completions","api_key":"ds-private"},
 		{"id":"sol","name":"GPT-5.6 Sol","provider":"custom","base_url":"https://model.example/v1","model":"gpt-5.6-sol","api_mode":"codex_responses","api_key":"sol-private"}
 	],"active_llm_profile_id":"sol"}`
 	req := httptest.NewRequest(http.MethodPut, "/api/v1/settings", strings.NewReader(body))
@@ -247,7 +247,7 @@ func TestSettingsAPISupportsMultipleLLMProfilesAndSelection(t *testing.T) {
 	switchReq := httptest.NewRequest(http.MethodPut, "/api/v1/settings", strings.NewReader(`{"active_llm_profile_id":"deepseek"}`))
 	switchRec := httptest.NewRecorder()
 	server.ServeHTTP(switchRec, switchReq)
-	if switchRec.Code != http.StatusOK || store.Snapshot().LLM.Model != "deepseek-chat" {
+	if switchRec.Code != http.StatusOK || store.Snapshot().LLM.Model != "deepseek-v4-pro" {
 		t.Fatalf("profile switch failed: status=%d body=%s", switchRec.Code, switchRec.Body.String())
 	}
 	if key, err := runtime.ModelAPIKey(); err != nil || key != "ds-private" {
```

**File**: `backend/internal/httpapi/token_usage_test.go` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ func TestTokenUsageStoreSeparatesEstimatedFromReal(t *testing.T) {
 func TestTokenUsageStoreSeparatesModels(t *testing.T) {
 	store := newTokenUsageStore(filepath.Join(t.TempDir(), "settings.json"))
 	store.add(tokenUsageRequest{Module: "stock-analysis", Model: "kimi-k3", Prompt: 1, Completion: 2, Total: 3})
-	store.add(tokenUsageRequest{Module: "stock-analysis", Model: "deepseek-chat", Prompt: 4, Completion: 5, Total: 9})
+	store.add(tokenUsageRequest{Module: "stock-analysis", Model: "deepseek-v4-pro", Prompt: 4, Completion: 5, Total: 9})
 
 	if len(store.Entries) != 2 {
 		t.Fatalf("entries = %d, want 2", len(store.Entries))
```

**File**: `docs/user-guide.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ MiniMax、智谱 GLM、通义千问、硅基流动等也可以使用。前往对
 
 | 服务商 | API Base URL | 模型 |
 | --- | --- | --- |
-| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
+| DeepSeek | `https://api.deepseek.com` | `deepseek-v4-pro`（或更快的 `deepseek-v4-flash`） |
 | Kimi（月之暗面） | `https://api.moonshot.cn/v1` | 点击「获取模型」选择 |
 
 接口协议选择 `Chat Completions`，粘贴 API Key，然后点击「**保存并测试连接**」。看到「Hermes 模型连接可用」即配置成功。
```

**File**: `frontend/src/components/SettingsDrawer.tsx` (modified, +1/-1)
```diff
@@ -504,7 +504,7 @@ export function SettingsDrawer({ config, open, onClose, onSaved }: Props) {
 								<div className="model-field">
 									<span className="model-field-heading"><span>模型</span>{modelListState === 'success' && <button type="button" onClick={() => setManualModel((current) => !current)}>{manualModel ? '使用下拉' : '手动输入'}</button>}</span>
 									<span className="model-picker-row">
-										{modelListState === 'success' && !manualModel ? <select value={model} onChange={(event) => { if (event.target.value === manualModelOption) setManualModel(true); else updateModel(event.target.value); }}><option value="">请选择模型</option>{selectableModels.map((option) => <option value={option.id} key={option.id}>{modelOptionLabel(option)}</option>)}<option value={manualModelOption}>手动输入其他模型…</option></select> : <input value={model} onChange={(event) => updateModel(event.target.value)} placeholder="例如 gpt-5.5 或 deepseek-chat" />}
+										{modelListState === 'success' && !manualModel ? <select value={model} onChange={(event) => { if (event.target.value === manualModelOption) setManualModel(true); else updateModel(event.target.value); }}><option value="">请选择模型</option>{selectableModels.map((option) => <option value={option.id} key={option.id}>{modelOptionLabel(option)}</option>)}<option value={manualModelOption}>手动输入其他模型…</option></select> : <input value={model} onChange={(event) => updateModel(event.target.value)} placeholder="例如 gpt-5.5 或 deepseek-v4-pro" />}
 										<button type="button" className="model-refresh-button" onClick={() => void fetchModels()} disabled={!config || state === 'saving' || modelListState === 'loading'}>{modelListState === 'loading' ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}{modelListState === 'success' ? '刷新' : '获取模型'}</button>
 									</span>
 									<small className={`model-list-message ${modelListState}`}>{modelListMessage || '请先填写 Base URL 和 API Key，再获取模型列表；也可继续手动输入。'}</small>
```

**File**: `frontend/src/lib/llm-providers.test.ts` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ describe('LLM provider definitions', () => {
 	it('provides model-discovery defaults for provider switching', () => {
 		expect(llmProviderDefinition('minimax')).toMatchObject({ baseURL: 'https://api.minimaxi.com/v1', apiMode: 'chat_completions' });
 		expect(llmProviderDefinition('zhipu')).toMatchObject({ baseURL: 'https://open.bigmodel.cn/api/paas/v4', apiMode: 'chat_completions' });
-		expect(llmProviderDefaultModel('deepseek')).toBe('deepseek-chat');
+		expect(llmProviderDefaultModel('deepseek')).toBe('deepseek-v4-pro');
 	});
 
 	it('falls back to custom settings for unknown providers', () => {
```

---

### Incident Patch 15: `77aa98c9` (2026-09-21)
**Commit Message**: fix: collapse ladder concepts and AI theme details by default

**File**: `frontend/src/components/LimitUpWorkspace.tsx` (modified, +26/-8)
```diff
@@ -493,7 +493,10 @@ function LadderRows({ aiEntries, levels, tradeDate, compact = false, showCurrent
 }
 
 function LadderStockChip({ tradeDate, ai, stock, compact, showCurrentChange, onSelect, onSelectBillboard }: { tradeDate: string; ai?: LadderThemeEntry; stock: LimitUpLadderStock; compact: boolean; showCurrentChange: boolean; onSelect: () => void; onSelectBillboard: () => void }) {
+	const [conceptsExpanded, setConceptsExpanded] = useState(false);
 	const concepts = [...new Set((stock.raw_concepts || []).flatMap(value => value.split(/[、,，;；]/)).map(value => value.trim()).filter(Boolean))];
+	const visibleConcepts = conceptsExpanded ? concepts : concepts.slice(0, 3);
+	const hiddenConceptCount = Math.max(0, concepts.length - 3);
 	const tooltip = [
 		`${stock.name} · 概念板块：${concepts.join('、') || '暂无概念数据'}`,
 		`数据源：${stock.source?.includes('duanxianxia') ? '开盘啦' : stock.source ? '东方财富补充' : '待确认'}`,
@@ -513,16 +516,31 @@ function LadderStockChip({ tradeDate, ai, stock, compact, showCurrentChange, onS
 				<span>{stock.limit_regime}</span>
 			</div>
 			<div className="limit-stock-concepts">
-                <div className="limit-stock-concepts-heading">概念板块<small>（开启AI分析更准确）</small></div>
-                <div className="limit-stock-concept-tags">{concepts.length ? concepts.map(concept => <span key={concept}>{concept}</span>) : <small>暂无概念数据</small>}</div>
-            </div>
-			{ai && <div className="limit-stock-ai-theme" title={ai.result ? `${ai.result.reason}\n依据：搜索报道线索（AI归因）\n归因交易日：${ai.trade_date || '未知'}\n识别时间：${ai.identified_at ? new Date(ai.identified_at).toLocaleString() : '未知'}${ai.error ? `\n${ai.error}` : ''}` : ai.error || '正在识别'}>
+				<div className="limit-stock-concepts-heading">概念板块<small>（开启AI分析更准确）</small></div>
+				<div className="limit-stock-concept-tags">
+					{visibleConcepts.length ? visibleConcepts.map(concept => <span key={concept}>{concept}</span>) : <small>暂无概念数据</small>}
+					{hiddenConceptCount > 0 && <button
+						type="button"
+						className="limit-stock-concept-toggle"
+						aria-expanded={conceptsExpanded}
+						aria-label={conceptsExpanded ? `收起${stock.name}的概念板块` : `展开${stock.name}其余${hiddenConceptCount}个概念`}
+						title={conceptsExpanded ? '收起概念' : `展开其余${hiddenConceptCount}个概念`}
+						onClick={event => { event.stopPropagation(); setConceptsExpanded(expanded => !expanded); }}
+						onKeyDown={event => event.stopPropagation()}
+					>{conceptsExpanded ? '收起' : `+${hiddenConceptCount} 展开`}</button>}
+				</div>
+			</div>
+			{ai && <div className="limit-stock-ai-theme" title={ai.result ? `依据：搜索报道线索（AI归因）\n归因交易日：${ai.trade_date || '未知'}\n识别时间：${ai.identified_at ? new Date(ai.identified_at).toLocaleString() : '未知'}${ai.error ? `\n${ai.error}` : ''}` : ai.error || '正在识别'}>
 				<span>{ai.result && ai.trade_date !== tradeDate ? `历史上涨题材 · ${ai.trade_date || '日期未知'}` : 'AI上涨题材'}</span><strong>{ai.result?.themes[0] || (ai.status === 'running' ? '识别中…' : '上涨题材待确认')}</strong>
-				{ai.result && <p className="limit-stock-ai-reason">{ai.result.reason}</p>}
 				{!ai.result && ai.error && <p className="limit-stock-ai-reason">{ai.error}</p>}
-				{ai.result?.caveat && <p className="limit-stock-ai-reason">{ai.result.caveat}</p>}
-				{ai.result && <div className="limit-stock-ai-sources">{ai.result.sources.map((source, index) => <a key={`${source.url}:${index}`} href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.title}${source.date ? ` · ${source.date}` : ''}${source.snippet ? `\n${source.snippet}` : ''}`} onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>来源{index + 1}</a>)}</div>}
-				{ai.result && <small>{ai.status === 'running' ? '刷新中' : ai.status === 'failed' ? '沿用旧结果' : '已缓存'}</small>}
+				{ai.result && <details className="limit-stock-ai-details" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
+					<summary><span className="when-collapsed">展开详情</span><span className="when-expanded">收起详情</span><ChevronDown size={12} aria-hidden="true" /></summary>
+					<div className="limit-stock-ai-details-body">
+						<p className="limit-stock-ai-reason">{ai.result.reason}</p>
+						{ai.result.caveat && <p className="limit-stock-ai-reason">{ai.result.caveat}</p>}
+						<div className="limit-stock-ai-sources">{ai.result.sources.map((source, index) => <a key={`${source.url}:${index}`} href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.title}${source.date ? ` · ${source.date}` : ''}${source.snippet ? `\n${source.snippet}` : ''}`}>来源{index + 1}</a>)}<small>{ai.status === 'running' ? '刷新中' : ai.status === 'failed' ? '沿用旧结果' : '已缓存'}</small></div>
+					</div>
+				</details>}
 			</div>}
 			<div className="limit-stock-sub"><span>{stock.symbol}</span><em>{stock.industry || '暂无行业数据'}</em></div>
 			{!compact ? <div className="limit-stock-meta"><span>{formatClock(stock.first_limit_time)}</span><span>{stock.board_type || (stock.open_count ? `开板${stock.o
```

**File**: `frontend/src/styles.css` (modified, +13/-1)
```diff
@@ -7417,16 +7417,28 @@ a:focus-visible {
 .reasoning-control > small[role="alert"] { grid-column: 1 / -1; color: var(--theme-red, #c43e3e); font-size: 12px; }
 
 .limit-stock-ai-theme { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; margin: 6px 0; font-size: 11px; }
-.limit-stock-ai-theme > span, .limit-stock-ai-theme > small { color: var(--muted); font-size: 10px; }
+.limit-stock-ai-theme > span, .limit-stock-ai-sources > small { color: var(--muted); font-size: 10px; }
 .limit-stock-ai-theme > strong { color: var(--purple); overflow-wrap: anywhere; }
 
 .limit-stock-ai-reason { flex-basis: 100%; margin: 0; color: var(--muted); line-height: 1.5; }
 
 .limit-stock-ai-sources { display: flex; flex-wrap: wrap; gap: 8px; }
+.limit-stock-ai-details { flex-basis: 100%; min-width: 0; }
+.limit-stock-ai-details > summary { display: flex; align-items: center; gap: 4px; width: fit-content; padding: 2px 0; border-radius: 3px; color: var(--theme-blue, #175ea9); font-size: 10px; cursor: pointer; list-style: none; }
+.limit-stock-ai-details > summary::-webkit-details-marker { display: none; }
+.limit-stock-ai-details > summary:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
+.limit-stock-ai-details > summary .when-expanded,
+.limit-stock-ai-details[open] > summary .when-collapsed { display: none; }
+.limit-stock-ai-details[open] > summary .when-expanded { display: inline; }
+.limit-stock-ai-details[open] > summary svg { transform: rotate(180deg); }
+.limit-stock-ai-details-body { display: grid; gap: 6px; padding-top: 6px; overflow-wrap: anywhere; }
 
 .limit-stock-concepts { margin: 6px 0; min-width: 0; }
 .limit-stock-concepts-heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px; color: var(--muted); font-size: 11px; margin-bottom: 6px; }
 .limit-stock-concepts-heading small { font-size: 10px; font-weight: normal; }
 .limit-stock-concept-tags { display: flex; flex-wrap: wrap; gap: 4px; }
 .limit-stock-concept-tags > span { max-width: 100%; padding: 3px 6px; border-radius: 4px; background: var(--theme-blue-soft, rgba(23, 94, 169, .07)); color: var(--theme-blue, #175ea9); font-size: 11px; line-height: 1.4; overflow-wrap: anywhere; }
 .limit-stock-concept-tags > small { color: var(--muted); font-size: 11px; }
+.limit-stock-concept-toggle { padding: 3px 6px; border: 0; border-radius: 4px; background: transparent; color: var(--theme-blue, #175ea9); font-size: 11px; line-height: 1.4; cursor: pointer; }
+.limit-stock-concept-toggle:hover { background: var(--theme-blue-soft, rgba(23, 94, 169, .07)); }
+.limit-stock-concept-toggle:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
```

#### Recent Merged Pull Requests:
- **PR #5** (closed): feat: 概念维度贯通（梯队概念云 / 选股概念列 / 自选概念标签） (@kkion111)
- **PR #4** (closed): feat: 策略选股引擎（内置 17 策略 + 指标流水线） (@kkion111)
- **PR #3** (closed): feat: 工作台市场看板（借鉴 tick-stock-panel） (@kkion111)
- **PR #2** (closed): feat: integrate chan.py engine and add 缠论选股 workspace (@kkion111)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
