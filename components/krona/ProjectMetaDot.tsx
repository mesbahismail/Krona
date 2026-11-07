import { Box } from '@mui/joy';

export default function ProjectMetaDot() {
	return <Box component="span" aria-hidden="true" sx={{ display: 'inline-block', width: 4, height: 4, flex: '0 0 4px', borderRadius: '50%', bgcolor: 'var(--krona-text)', opacity: 0.16 }} />;
}
