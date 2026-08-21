/**
 * Section.tsx — 设置页「技能市场」section 组件。
 *
 * 采用 DSH 官方设计语言:使用 @deepseek-ai/dsh-client-ui-primitives 的
 * Button/Pill/Input,配合官方 --dsw-alias-* token 与 dshmarket 同类卡片样式,
 * 自适应浅/深色主题,与内置「插件市场」观感一致。
 *
 * 数据通过 MarketRemote 走 host 的 /skills-marketplace/* 端点。
 * 渲染三个层级:来源列表 → 插件目录(插件维度)→ 插件详情(技能开关)。
 */
import { MarketRemote } from './remote.ts';
export declare function SkillMarketSection(props: {
    remote?: MarketRemote;
}): import("react").JSX.Element;
