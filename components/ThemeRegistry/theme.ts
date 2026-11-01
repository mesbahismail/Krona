import { extendTheme } from '@mui/joy/styles';
import { TbChevronDown } from 'react-icons/tb';
import {
	kronaSelectListboxSx,
	kronaPopoverPositionModifiers,
	KRONA_DROPDOWN_POPOVER_Z_INDEX,
} from '@/lib/kronaStyles';

// Type declarations
declare module '@mui/joy/styles' {
	interface BreakpointOverrides {
		tablet: true;
	}
}

declare module '@mui/joy/Button' {
	interface ButtonPropsColorOverrides {
		secondary: true;
	}
}

declare module '@mui/joy/Select' {
	interface SelectPropsSizeOverrides {
		md: true;
		lg: true;
	}
	interface SelectPropsVariantOverrides {
		plain: true;
		outlined: true;
		soft: true;
		solid: true;
	}
	interface SelectPropsSlots {
		indicator?: true;
	}
}

const FONT_SANS =
	'Poppins, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const FONT_MONO =
	'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace';

const KRONA_TITLE_FONT_WEIGHT = 600;

const theme = extendTheme({
	breakpoints: {
		values: {
			xs: 0,
			sm: 600,
			tablet: 800,
			md: 900,
			lg: 1200,
			xl: 1536,
		},
	},
	fontFamily: {
		body: FONT_SANS,
		display: FONT_SANS,
		code: FONT_MONO,
	},
	typography: {
		h1: { fontWeight: KRONA_TITLE_FONT_WEIGHT },
		h2: { fontWeight: KRONA_TITLE_FONT_WEIGHT },
		h3: { fontWeight: KRONA_TITLE_FONT_WEIGHT },
		h4: { fontWeight: KRONA_TITLE_FONT_WEIGHT },
		'title-lg': { fontWeight: KRONA_TITLE_FONT_WEIGHT },
		'title-md': { fontWeight: KRONA_TITLE_FONT_WEIGHT },
		'title-sm': { fontWeight: KRONA_TITLE_FONT_WEIGHT },
	},
	components: {
		JoyModal: {
			styleOverrides: {
				backdrop: {
					backgroundColor: 'var(--krona-modal-overlay, rgba(6, 4, 18, 0.5))',
				},
			},
		},

		JoyButton: {
			defaultProps: {
				color: 'primary',
			},
			styleOverrides: {
				root: ({ ownerState }) => ({
					fontFamily: FONT_SANS,
					borderRadius: '999px',
					minHeight: 'var(--krona-control-height, 32px)',
					height: 'var(--krona-control-height, 32px)',
					maxHeight: 'var(--krona-control-height, 32px)',
					...(ownerState.color === 'primary' &&
						ownerState.variant === 'solid' && {
							backgroundColor: '#34B3F1',
								border: '1px solid transparent',
							boxSizing: 'border-box',
							color: '#050B0F',
							minWidth: 'unset',
							transition:
								'background-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease',
							'&:hover': {
								backgroundColor: '#51C6FF',
								border: '1px solid transparent',
								boxShadow: 'var(--krona-primary-hover-shadow)',
							},
							'&:active, &:focus-visible': {
								border: '1px solid transparent',
								boxShadow:
									'var(--krona-control-inset-stroke), var(--krona-accent-shadow)',
							},
							'&&': { fontWeight: 600 },
						}),

					...(ownerState.color === 'secondary' &&
						ownerState.variant === 'outlined' && {
							border: '1px solid #355067',
							color: '#ffffff',
							backgroundColor: 'transparent',
							minWidth: 'unset',
							transition: 'border-color 0.2s ease, background-color 0.2s ease',
							'&:hover': {
								backgroundColor: '#091D29',
								borderColor: '#567691',
							},
							'&&': { fontWeight: 500 },
						}),
					...(ownerState.color === 'secondary' &&
						ownerState.variant === 'outlined' &&
						ownerState.size === 'sm' && {
							border: '1px solid #444444',
							color: '#ffffff',
							backgroundColor: 'transparent',
							minHeight: '32px',
							padding: '0px 8px',
							minWidth: 'unset',
							transition: 'border-color 0.2s ease, background-color 0.2s ease',
							'&:hover': {
								backgroundColor: 'var(--krona-overlay-hover)',
								borderColor: 'var(--krona-widget-border-hover)',
							},
							'&&': { fontWeight: 500 },
						}),
					...(ownerState.color === 'secondary' &&
						ownerState.variant === 'plain' && {
							color: '#ffffff',
							backgroundColor: 'transparent',
					padding: '0 8px',
							minHeight: 'auto',
							transition: 'border-color 0.2s ease, background-color 0.2s ease',
							'&:hover': {
								backgroundColor: 'transparent',
								textUnderlineOffset: '4px',
							},
							'&:active': {
								transform: 'none',
							},
							'&&': {
								fontWeight: 500,
							},
						}),
				}),
			},
		},

		JoyTabs: {
			styleOverrides: {
				root: {
					fontFamily: FONT_SANS,
				},
			},
		},

		JoyTab: {
			styleOverrides: {
				root: {
					fontFamily: FONT_SANS,
					borderRadius: '999px',
					minHeight: 'var(--krona-control-height, 32px)',
					height: 'var(--krona-control-height, 32px)',
					maxHeight: 'var(--krona-control-height, 32px)',
				},
			},
		},

		JoySelect: {
			defaultProps: {
				variant: 'outlined',
				color: 'neutral',
				slotProps: {
					indicator: {
						component: TbChevronDown,
						sx: {
							color: 'var(--krona-text-muted)',
							transition: 'transform 0.2s ease',
							'&[data-joy-open]': {
								transform: 'rotate(-180deg)',
							},
							marginLeft: '4px',
						},
					},
					listbox: {
						sx: kronaSelectListboxSx,
						modifiers: kronaPopoverPositionModifiers,
					},
				},
			},
			styleOverrides: {
				root: () => ({
					borderRadius: '20px',
						fontSize: 'var(--krona-control-font-size, 14px)',
					minHeight: 'var(--krona-control-height, 32px)',
					border: '1px solid var(--krona-input-border)',
					background: 'var(--krona-dropdown-bg)',
					padding: '0 12px',
					fontFamily: FONT_SANS,
					transition: 'border-color 0.2s ease, background-color 0.2s ease',
					color: 'var(--krona-text)',
					boxShadow: 'none',
					'& [class*=selectedValue]': {
						paddingRight: '8px',
						color: 'var(--krona-text)',
					},
					'&:hover': {
						borderColor: 'var(--krona-input-border)',
						backgroundColor: 'var(--krona-secondary-bg)',
					},
					'&:focus-within': {
						borderColor: 'var(--krona-input-border)',
						outline: 'none',
						boxShadow: 'none',
					},
					'&::before, &::after, fieldset': {
						border: 'none',
						outline: 'none',
						boxShadow: 'none',
					},
				}),
			},
		},

		JoyTooltip: {
			styleOverrides: {
				root: {
					fontFamily: FONT_SANS,
					fontSize: 12,
					fontWeight: 600,
					lineHeight: 1.35,
					borderRadius: '14px',
						padding: '6px 10px',
					color: 'var(--krona-text)',
					background: 'var(--krona-dropdown-bg)',
					border: '1px solid var(--krona-surface-border)',
					backdropFilter:
						'blur(var(--krona-shell-blur)) saturate(var(--krona-shell-saturate))',
					WebkitBackdropFilter:
						'blur(var(--krona-shell-blur)) saturate(var(--krona-shell-saturate))',
					boxShadow: 'var(--krona-dropdown-shadow)',
					zIndex: KRONA_DROPDOWN_POPOVER_Z_INDEX + 20,
				},
				arrow: {
					color: 'var(--krona-dropdown-bg)',
					'&::before': {
						background: 'var(--krona-dropdown-bg)',
					border: '1px solid var(--krona-surface-border)',
					},
				},
			},
		},

		JoyMenu: {
			defaultProps: {
				modifiers: kronaPopoverPositionModifiers,
			},
			styleOverrides: {
				root: {
					borderRadius: '20px',
					background: 'var(--krona-dropdown-bg)',
					border: '1px solid var(--krona-surface-border)',
					backdropFilter: 'blur(24px) saturate(180%)',
					WebkitBackdropFilter: 'blur(24px) saturate(180%)',
					boxShadow: 'var(--krona-dropdown-shadow)',
					color: 'var(--krona-text)',
					overflow: 'hidden',
					zIndex: KRONA_DROPDOWN_POPOVER_Z_INDEX,
						'--List-padding': '6px',
					'--List-radius': '20px',
					'--ListItem-radius': '14px',
				},
			},
		},

			JoyMenuItem: {
				styleOverrides: {
					root: {
						borderRadius: '14px',
						color: 'var(--krona-text)',
						fontFamily: FONT_SANS,
						fontSize: 'var(--krona-control-font-size, 14px)',
						outline: 'none',
					'&:hover': {
						backgroundColor: 'var(--krona-secondary-bg)',
					},
					'&:focus, &:focus-visible, &.Mui-focusVisible': {
						outline: 'none',
						boxShadow: 'none',
						backgroundColor: 'var(--krona-secondary-bg)',
					},
				},
			},
		},

			JoyList: {
				styleOverrides: {
					root: {
						'--List-padding': '6px',
						'--List-radius': '20px',
						backgroundColor: 'transparent',
						fontFamily: FONT_SANS,
					},
				},
			},

		JoyOption: {
			styleOverrides: {
				root: {
						color: 'var(--krona-text)',
						fontSize: 'var(--krona-control-font-size, 14px)',
						padding: '8px 12px',
						borderRadius: '14px',
						fontFamily: FONT_SANS,
					'&:hover': {
						backgroundColor: 'var(--krona-secondary-bg)',
					},
					'&:focus, &:focus-visible, &.Mui-focusVisible': {
						outline: 'none',
						boxShadow: 'none',
						backgroundColor: 'var(--krona-secondary-bg)',
					},
					'&[aria-selected="true"]': {
						backgroundColor: 'var(--krona-secondary-bg)',
						fontWeight: 600,
					},
				},
			},
		},

		JoyRadio: {
			styleOverrides: {
					radio: {
						backgroundColor: 'transparent',
						color: 'transparent',
						borderWidth: 2,
						borderColor: 'var(--krona-input-border)',
						fontFamily: FONT_SANS,
						'&.Mui-checked': {
						borderColor: '#EDB772',
						color: '#EDB772',
					},
					'&:hover': {
						backgroundColor: 'var(--krona-overlay-hover)',
					},
				},
			},
		},

		JoyInput: {
			styleOverrides: {
				input: {
					'&::placeholder': {
						color: 'var(--krona-placeholder-color, var(--krona-text-muted, #aaa))',
						opacity: 1,
						transition: 'opacity 0.15s ease',
					},
					'&:not(:placeholder-shown)::placeholder': {
						opacity: 0,
					},
				},
			},
		},

		JoyFormLabel: {
			styleOverrides: {
				root: {
					fontFamily: FONT_SANS,
					/* Joy default sm label is ~14px; Krona titles sit 2px smaller. */
					fontSize: 12,
					lineHeight: 1.35,
					fontWeight: 500,
					marginBottom: '6px',
					color: 'var(--krona-text)',
				},
			},
		},

			JoyTextarea: {
			defaultProps: {
				color: 'primary',
				variant: 'outlined',
			},
				styleOverrides: {
					root: () => ({
						borderRadius: '16px',
						fontSize: '14px',
						fontFamily: FONT_SANS,
					transition: 'border-color 0.2s ease, background-color 0.2s ease',
					'--Textarea-paddingBlock': 'calc(0.5rem - 1px)',
					'--Textarea-minHeight': '40px',
					border: '1px solid var(--krona-input-border)',
					backgroundColor: 'transparent',
					color: 'var(--krona-text)',
					'&:hover': {
						borderColor: 'var(--krona-widget-border-hover)',
						backgroundColor: 'transparent',
					},
					'&:focus-within': {
						borderColor: 'var(--krona-widget-border-hover)',
						outline: 'none',
						boxShadow: 'none',
					},
					'&::before, &::after, fieldset': {
						border: 'none',
						outline: 'none',
						boxShadow: 'none',
					},
					}),
					textarea: {
						fontFamily: FONT_SANS,
					'&::placeholder': {
						color: 'var(--krona-placeholder-color, var(--krona-text-muted, #aaa))',
						opacity: 1,
						transition: 'opacity 0.15s ease',
					},
					'&:not(:placeholder-shown)::placeholder': {
						opacity: 0,
					},
				},
			},
		},
	},
});

export default theme;
