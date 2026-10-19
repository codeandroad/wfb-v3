"use client"
import { Button as BaseButton,buttonVariants } from "@/components/ui/button"
import type { ComponentProps } from "react"
export { buttonVariants }
export function Button(props: ComponentProps<typeof BaseButton>) { return <BaseButton {...props} data-research-button={props.variant || "default"} /> }
