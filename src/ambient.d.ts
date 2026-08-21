/**
 * ambient.d.ts — 对宿主提供的 @deepseek-ai/* 包的运行时模块声明。
 *
 * 宿主在运行时经 profile fallback 提供这些包;构建期无法解析类型,故用瘦声明。
 * 仅在 settings.ts 的运行时 import('@deepseek-ai/schemastery') 处避免 TS2307。
 */

declare module '@deepseek-ai/schemastery' {
  export interface ZType {
    object(shape: Record<string, ZType>): ZType
    string(): ZType
    boolean(): ZType
    array(item?: ZType): ZType
    natural(): ZType
  }
  const z: ZType
  export default z
  export { z }
}

declare module '@deepseek-ai/dsh-settings' {
  export interface SettingsNamespaceOptions {
    applies?: 'live' | 'user'
  }
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SVGProps } from 'react'
  export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'toolbar'
  export function Button(props: {
    variant?: ButtonVariant
    size?: 'md' | 'sm'
    icon?: ReactNode
    className?: string
    children?: ReactNode
  } & ButtonHTMLAttributes<HTMLButtonElement>): ReactNode
  export function Pill(props: { active?: boolean; className?: string; children?: ReactNode; onClick?: () => void } & ButtonHTMLAttributes<HTMLButtonElement>): ReactNode
  export function Input(props: { icon?: ReactNode; className?: string } & InputHTMLAttributes<HTMLInputElement>): ReactNode
  export function IconChevronDownOutline14(props: SVGProps<SVGSVGElement>): ReactNode
  export function IconLoadingOutline16(props: SVGProps<SVGSVGElement>): ReactNode
  export function Menu(props: unknown): ReactNode
  export function Modal(props: unknown): ReactNode
  export function DisclosureRow(props: unknown): ReactNode
  export function Tooltip(props: unknown): ReactNode
}
