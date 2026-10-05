import type { ReportTemplate } from './reports'
import { reportOptions } from './report-options'

export type ReportTheme = { id: string; owner: string | null; name: string; color: string; background: string; headerBackground: string; headerText: string; borderColor: string; stripeColor: string }
export const SYSTEM_THEMES: ReportTheme[] = [
  { id:'forest', owner:null, name:'松绿', color:'#245f50', background:'#ffffff', headerBackground:'#edf2ef', headerText:'#245f50', borderColor:'#91aaa0', stripeColor:'#f5f8f6' },
  { id:'blue', owner:null, name:'海蓝', color:'#234d73', background:'#ffffff', headerBackground:'#eaf1f8', headerText:'#234d73', borderColor:'#94abc0', stripeColor:'#f4f7fa' },
  { id:'ink', owner:null, name:'简洁黑白', color:'#303030', background:'#ffffff', headerBackground:'#eeeeee', headerText:'#303030', borderColor:'#999999', stripeColor:'#f7f7f7' },
  { id:'brown', owner:null, name:'栗棕', color:'#70452c', background:'#ffffff', headerBackground:'#f4eee8', headerText:'#70452c', borderColor:'#b6a190', stripeColor:'#faf7f3' },
  { id:'teal', owner:null, name:'青碧', color:'#17656a', background:'#ffffff', headerBackground:'#eaf4f3', headerText:'#17656a', borderColor:'#8cacab', stripeColor:'#f4f9f8' },
  { id:'plum', owner:null, name:'梅紫', color:'#654366', background:'#ffffff', headerBackground:'#f2edf3', headerText:'#654366', borderColor:'#af9cb2', stripeColor:'#f9f6fa' },
  { id:'rose', owner:null, name:'玫瑰', color:'#863f53', background:'#ffffff', headerBackground:'#f8edf0', headerText:'#863f53', borderColor:'#bd96a1', stripeColor:'#fcf7f8' },
  { id:'amber', owner:null, name:'琥珀', color:'#78551d', background:'#ffffff', headerBackground:'#f6f0e3', headerText:'#78551d', borderColor:'#b5a17b', stripeColor:'#fbf8f0' },
  { id:'slate', owner:null, name:'岩灰', color:'#405569', background:'#ffffff', headerBackground:'#edf1f5', headerText:'#405569', borderColor:'#99a7b5', stripeColor:'#f6f8fa' },
  { id:'olive', owner:null, name:'橄榄', color:'#52612d', background:'#ffffff', headerBackground:'#f0f3e8', headerText:'#52612d', borderColor:'#a3ac8b', stripeColor:'#f8faf3' },
]
export function themeOf(t:ReportTemplate):ReportTheme { const o=reportOptions(t);return {id:'current',owner:null,name:'当前配色',color:t.color,background:t.background,headerBackground:o.headerBackground,headerText:o.headerText,borderColor:o.borderColor,stripeColor:o.stripeColor} }
export function applyTheme(t:ReportTemplate,theme:ReportTheme):ReportTemplate {return {...t,color:theme.color,background:theme.background,options:{...t.options,headerBackground:theme.headerBackground,headerText:theme.headerText,borderColor:theme.borderColor,stripeColor:theme.stripeColor}}}
