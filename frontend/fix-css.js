import fs from 'fs'

const files = [
    'src/pages/Generate.css',
    'src/pages/Designer.css',
    'src/pages/ClientView.css',
    'src/pages/Catalog.css',
    'src/index.css',
    'src/components/ui/Navbar.css',
    'src/components/designer/ManufactureScore.css',
    'src/components/generate/ConceptCard.css',
    'src/components/generate/AnalysisOverlay.css'
];

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('backdrop-filter') && !content.includes('-webkit-backdrop-filter')) {
        content = content.replace(/backdrop-filter(?!: *none):[ \t]*([^;]+);/g, '-webkit-backdrop-filter: $1;\n    backdrop-filter: $1;');
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed', file);
    }
}
