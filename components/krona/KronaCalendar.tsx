'use client';

import * as React from 'react';
import { Box } from '@mui/joy';
import { DayPicker, type DayPickerProps } from 'react-day-picker';
import 'react-day-picker/style.css';
import { kronaCalendarDayPickerSx } from '@/lib/kronaCalendarStyles';

export default function KronaCalendar(props: DayPickerProps) {
	return (
		<Box sx={kronaCalendarDayPickerSx}>
			<DayPicker showOutsideDays {...props} />
		</Box>
	);
}
