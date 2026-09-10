import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
    Sparkles, ArrowRight, Box, ShieldCheck, Cpu, Download,
    CheckCircle2, Layers, Zap, TrendingUp, Gem, Sliders,
    Printer, Share2, RefreshCw, AlertTriangle, Eye, Compass,
    Check
} from 'lucide-react'
import './LandingPage.css'

export default function LandingPage() {
    const navigate = useNavigate()

    return (
        <div className="landing-container">

            {/* ══════════════════════════════════════════════════════
                1. HERO SECTION
               ══════════════════════════════════════════════════════ */}
            <section className="land-hero">
                <div className="land-hero-glow" />

                <div className="land-hero-grid">
                    {/* Left: Headline & Actions */}
                    <motion.div
                        className="land-hero-content"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="land-eyebrow">
                            <span className="land-eyebrow-dot" />
                            <Gem size={13} className="text-gold" />
                            <span>PLACE VENDÔME AUTONOMOUS 3D GOLDSMITH</span>
                        </div>

                        <h1 className="land-hero-title">
                            From Jewelry Photo to <br />
                            <span className="land-gold-text">Production 3D CAD</span> <br />
                            in Under 30 Seconds
                        </h1>

                        <p className="land-hero-sub">
                            The intelligent generative AI atelier for master goldsmiths and luxury maisons.
                            Upload any camera photo or sketch to synthesize an exact 1:1 watertight 3D model
                            with photo-captured vertex colors, live GoldAPI spot valuation, and wax-print ready STL export.
                        </p>

                        <div className="land-hero-actions">
                            <button
                                className="land-btn-primary"
                                onClick={() => navigate('/generate')}
                                id="hero-launch-studio-btn"
                            >
                                <Sparkles size={18} />
                                <span>Launch AI 3D Studio</span>
                                <ArrowRight size={18} />
                            </button>

                            <a href="#workflow" className="land-btn-secondary">
                                <Compass size={16} />
                                <span>Explore Architecture & Flow</span>
                            </a>
                        </div>

                        {/* Trust Metrics Bar */}
                        <div className="land-hero-metrics">
                            <div className="land-metric-item">
                                <span className="land-metric-number">256³</span>
                                <span className="land-metric-label">Marching Cubes Density</span>
                            </div>
                            <div className="land-metric-sep" />
                            <div className="land-metric-item">
                                <span className="land-metric-number">1:1</span>
                                <span className="land-metric-label">Photo Multi-Color Mesh</span>
                            </div>
                            <div className="land-metric-sep" />
                            <div className="land-metric-item">
                                <span className="land-metric-number">0</span>
                                <span className="land-metric-label">Non-Manifold Edges</span>
                            </div>
                            <div className="land-metric-sep" />
                            <div className="land-metric-item">
                                <span className="land-metric-number">100%</span>
                                <span className="land-metric-label">Real Free Tier APIs</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right: Live Interactive Studio Gateway Portal (Zero Pre-saved Models) */}
                    <motion.div
                        className="land-hero-stage-wrap"
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="land-stage-frame">
                            <div className="land-stage-header">
                                <div className="land-stage-pill">
                                    <span className="land-live-dot" />
                                    <span>Zero Pre-saved Assets • 100% Real-Time Neural Conversion</span>
                                </div>
                                <div className="land-stage-badge">
                                    <span>Place Vendôme Autonomous Atelier</span>
                                </div>
                            </div>

                            {/* Direct Interactive Studio Portal */}
                            <div
                                className="land-stage-portal-card"
                                onClick={() => navigate('/generate')}
                                role="button"
                                tabIndex={0}
                                title="Click to launch AI 3D Studio"
                            >
                                <div className="land-portal-glow" />
                                <div className="land-portal-icon-ring">
                                    <Sparkles size={38} className="text-gold" />
                                </div>
                                <h3 className="land-portal-title">Convert Any Jewelry Photo Into 3D</h3>
                                <p className="land-portal-desc">
                                    Upload rings, necklaces, drop pendants, earrings, or cuffs. Every piece is reconstructed dynamically from scratch using live multimodal vision and 256³ marching cubes.
                                </p>

                                {/* Real AI Pipeline Step Breakdown */}
                                <div className="land-portal-steps">
                                    <div className="land-portal-step">
                                        <div className="land-step-num">01</div>
                                        <div className="land-step-info">
                                            <strong>Gemini 3.6 Flash</strong>
                                            <span>Multi-stone facets, setting type & metal alloy</span>
                                        </div>
                                    </div>
                                    <div className="land-portal-step">
                                        <div className="land-step-num">02</div>
                                        <div className="land-step-info">
                                            <strong>TripoSR 256³ Marching Cubes</strong>
                                            <span>1:1 surface field synthesis with safe margins</span>
                                        </div>
                                    </div>
                                    <div className="land-portal-step">
                                        <div className="land-step-num">03</div>
                                        <div className="land-step-info">
                                            <strong>Watertight STL / OBJ / GLB</strong>
                                            <span>Export calibrated binary mesh for 3D wax printing</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="land-portal-cta-btn">
                                    <Box size={16} />
                                    <span>Drop Photo & Enter AI Studio</span>
                                    <ArrowRight size={16} />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                2. THE PROBLEM: The High Jewelry CAD Bottleneck
               ══════════════════════════════════════════════════════ */}
            <section className="land-section land-problem-section" id="problem">
                <div className="land-section-header">
                    <div className="land-section-badge danger">
                        <AlertTriangle size={14} />
                        <span>THE HIGH JEWELRY BOTTLENECK</span>
                    </div>
                    <h2 className="land-section-title">
                        Why Traditional Jewelry CAD Slows Down Modern Ateliers
                    </h2>
                    <p className="land-section-sub">
                        For decades, jewelry design has been held back by manual polygon modeling, slow turnaround loops,
                        and casting failures that cost jewelers high-value sales.
                    </p>
                </div>

                <div className="land-problem-grid">
                    <div className="land-problem-card">
                        <div className="land-problem-icon-wrap">
                            <RefreshCw size={24} className="text-danger" />
                        </div>
                        <h3 className="land-card-title">3 to 5 Days Manual Turnaround</h3>
                        <p className="land-card-desc">
                            Sculpting a custom ring in Rhino or MatrixGold takes up to a week of manual NURBS modeling.
                            By the time the render is ready, impatient luxury clients have walked into another boutique.
                        </p>
                        <div className="land-card-footer text-danger">
                            <span>Avg. client drop-off rate: 42%</span>
                        </div>
                    </div>

                    <div className="land-problem-card">
                        <div className="land-problem-icon-wrap">
                            <TrendingUp size={24} className="text-danger" />
                        </div>
                        <h3 className="land-card-title">Expensive CAD Outsourcing Overhead</h3>
                        <p className="land-card-desc">
                            Freelance jewelry CAD designers charge $150 to $400 per custom design, with added fees
                            for minor prong or bezel modifications, eroding profit margins on custom commissions.
                        </p>
                        <div className="land-card-footer text-danger">
                            <span>$3,000+ monthly designer overhead</span>
                        </div>
                    </div>

                    <div className="land-problem-card">
                        <div className="land-problem-icon-wrap">
                            <Eye size={24} className="text-danger" />
                        </div>
                        <h3 className="land-card-title">Flat 2D Sketch Ambiguity</h3>
                        <p className="land-card-desc">
                            2D paper sketches fail to convey real gold casting weight, claw integrity, diamond sparkle,
                            or setting height. Misunderstandings between client and goldsmith lead to rejected castings.
                        </p>
                        <div className="land-card-footer text-danger">
                            <span>High rate of costly remakes</span>
                        </div>
                    </div>

                    <div className="land-problem-card">
                        <div className="land-problem-icon-wrap">
                            <Printer size={24} className="text-danger" />
                        </div>
                        <h3 className="land-card-title">Failed Resin Wax Prints & Castings</h3>
                        <p className="land-card-desc">
                            Generic 3D models produce non-manifold boundaries, inverted normals, and zero-thickness walls
                            that cause wax 3D printers to fail and ruin investment flask pours.
                        </p>
                        <div className="land-card-footer text-danger">
                            <span>Porous casting & broken prongs</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                3. THE SOLUTION: JewelCraft AI
               ══════════════════════════════════════════════════════ */}
            <section className="land-section land-solution-section" id="solution">
                <div className="land-section-header">
                    <div className="land-section-badge success">
                        <ShieldCheck size={14} />
                        <span>THE AUTONOMOUS AI GOLDSMITH</span>
                    </div>
                    <h2 className="land-section-title">
                        Engineered Specifically for High Jewelry Precision
                    </h2>
                    <p className="land-section-sub">
                        JewelCraft AI combines multimodal vision with high-resolution neural field synthesis
                        to automate the entire pipeline from photo to castable gold alloy.
                    </p>
                </div>

                <div className="land-solution-grid">
                    <div className="land-solution-card">
                        <div className="land-solution-icon">
                            <Zap size={24} className="text-gold" />
                        </div>
                        <h3 className="land-card-title">Instant 1:1 Photo-to-Mesh Synthesis</h3>
                        <p className="land-card-desc">
                            Upload any photo from a smartphone camera. Hugging Face TripoSR directly computes the 3D surface
                            with 256³ Marching Cubes, capturing the exact ring curvature without generic fallbacks.
                        </p>
                    </div>

                    <div className="land-solution-card">
                        <div className="land-solution-icon">
                            <Cpu size={24} className="text-gold" />
                        </div>
                        <h3 className="land-card-title">Gemini 3.6 Flash Geometric Vision</h3>
                        <p className="land-card-desc">
                            Our vision pipeline identifies metal type, stone cuts (Round Brilliant, Oval, Emerald),
                            claw architecture, and shank dimensions with 100% authentic free-tier API intelligence.
                        </p>
                    </div>

                    <div className="land-solution-card">
                        <div className="land-solution-icon">
                            <Printer size={24} className="text-gold" />
                        </div>
                        <h3 className="land-card-title">100% Watertight Wax-Print Guarantee</h3>
                        <p className="land-card-desc">
                            Export certified watertight .STL files ready for Formlabs, Asiga, and EnvisionTEC resin printers.
                            Zero non-manifold edges, verified for seamless lost-wax casting.
                        </p>
                    </div>

                    <div className="land-solution-card">
                        <div className="land-solution-icon">
                            <TrendingUp size={24} className="text-gold" />
                        </div>
                        <h3 className="land-card-title">Live Metal Market Spot Valuation</h3>
                        <p className="land-card-desc">
                            Integrated with real-time GoldAPI spot prices. Computes exact 18K solid gold weight and gives
                            you immediate retail casting valuation to quote clients on the spot.
                        </p>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                4. THE 4-STEP WORKFLOW
               ══════════════════════════════════════════════════════ */}
            <section className="land-section land-workflow-section" id="workflow">
                <div className="land-section-header">
                    <div className="land-section-badge gold">
                        <Layers size={14} />
                        <span>SEAMLESS ATELIER PIPELINE</span>
                    </div>
                    <h2 className="land-section-title">
                        From Photo to Castable 3D CAD in 4 Steps
                    </h2>
                    <p className="land-section-sub">
                        Designed for counter-top jewelers and bespoke ateliers to convert client ideas into interactive 3D in seconds.
                    </p>
                </div>

                <div className="land-flow-track">
                    <div className="land-flow-step">
                        <div className="land-step-number">01</div>
                        <div className="land-step-dot" />
                        <h3 className="land-step-title">Upload Photo or Sketch</h3>
                        <p className="land-step-desc">
                            Drop a camera shot of a customer's piece, a hand-drawn sketch, or type a natural language description into the CAD prompt engine.
                        </p>
                        <div className="land-step-pill">PNG • JPG • WebP • Text</div>
                    </div>

                    <div className="land-flow-step">
                        <div className="land-step-number">02</div>
                        <div className="land-step-dot" />
                        <h3 className="land-step-title">Gemini Vision Extraction</h3>
                        <p className="land-step-desc">
                            Gemini 3.6 Flash analyzes gemstone cut, carat weight, prong mounts, metal alloy, and structural proportions in real-time.
                        </p>
                        <div className="land-step-pill">12+ Parametric Metrics</div>
                    </div>

                    <div className="land-flow-step">
                        <div className="land-step-number">03</div>
                        <div className="land-step-dot" />
                        <h3 className="land-step-title">Neural Field 3D Synthesis</h3>
                        <p className="land-step-desc">
                            Hugging Face TripoSR processes the neural surface field at 256³ resolution. Smooth vertex normals are computed to eliminate faceting.
                        </p>
                        <div className="land-step-pill">Multi-Color Vertex Colors</div>
                    </div>

                    <div className="land-flow-step">
                        <div className="land-step-number">04</div>
                        <div className="land-step-dot" />
                        <h3 className="land-step-title">Atelier Vitrine & CAD Export</h3>
                        <p className="land-step-desc">
                            Inspect under Showroom, Studio, or Dramatic lighting. Test metal swatches, check live valuation, and download production STL, GLB, and OBJ.
                        </p>
                        <div className="land-step-pill">Watertight .STL • .GLB • .OBJ</div>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                5. COMPREHENSIVE FEATURES MATRIX ("What You Get")
               ══════════════════════════════════════════════════════ */}
            <section className="land-section land-features-section" id="features">
                <div className="land-section-header">
                    <div className="land-section-badge gold">
                        <Gem size={14} />
                        <span>SUITE ARCHITECTURE</span>
                    </div>
                    <h2 className="land-section-title">
                        Everything You Need to Run an AI-Powered Jewelry Atelier
                    </h2>
                    <p className="land-section-sub">
                        A full-stack suite engineered to replace fragmented legacy tools with a unified luxury workflow.
                    </p>
                </div>

                <div className="land-features-grid">
                    <div className="land-feature-card">
                        <div className="land-feat-icon">
                            <Box size={22} className="text-gold" />
                        </div>
                        <h3 className="land-feat-title">Photo Multi-Color Vertex Engine</h3>
                        <p className="land-feat-desc">
                            Captures over 10,000 photo-calibrated vertex colors. Gold bands retain rich warm luster while diamond pavé highlights sparkle white without flat color overriding.
                        </p>
                        <ul className="land-feat-bullets">
                            <li><Check size={14} /> 1:1 true photo color replication</li>
                            <li><Check size={14} /> Metallic reflection PBR calibration</li>
                            <li><Check size={14} /> Zero single-color flat tinting</li>
                        </ul>
                    </div>

                    <div className="land-feature-card">
                        <div className="land-feat-icon">
                            <Eye size={22} className="text-gold" />
                        </div>
                        <h3 className="land-feat-title">Master Jewelers' 3-Tier Lighting</h3>
                        <p className="land-feat-desc">
                            Switch between physical lighting scenarios tailored to simulate authentic luxury salon environments and daylight inspection softboxes.
                        </p>
                        <ul className="land-feat-bullets">
                            <li><Check size={14} /> <strong>Showroom</strong>: 3200K warm salon key light</li>
                            <li><Check size={14} /> <strong>Studio</strong>: 5500K neutral daylight softbox</li>
                            <li><Check size={14} /> <strong>Dramatic</strong>: Museum chiaroscuro spotlight</li>
                        </ul>
                    </div>

                    <div className="land-feature-card">
                        <div className="land-feat-icon">
                            <TrendingUp size={22} className="text-gold" />
                        </div>
                        <h3 className="land-feat-title">Live Metal Market Spot Valuation</h3>
                        <p className="land-feat-desc">
                            Integrated with real-time GoldAPI rates. Calculates casting volume, solid gold weight, and generates instant retail quotes for clients.
                        </p>
                        <ul className="land-feat-bullets">
                            <li><Check size={14} /> Real-time spot price integration</li>
                            <li><Check size={14} /> 18K Yellow, Rose, White & Platinum density</li>
                            <li><Check size={14} /> Immediate counter-top sales quoting</li>
                        </ul>
                    </div>

                    <div className="land-feature-card">
                        <div className="land-feat-icon">
                            <Printer size={22} className="text-gold" />
                        </div>
                        <h3 className="land-feat-title">Watertight 3D Wax Printing (STL)</h3>
                        <p className="land-feat-desc">
                            One-click export to production-grade .STL calibrated for direct lost-wax resin printing. Closed manifold solids ensure zero casting blowouts.
                        </p>
                        <ul className="land-feat-bullets">
                            <li><Check size={14} /> Direct export for Formlabs & Asiga</li>
                            <li><Check size={14} /> Certified closed manifold geometry</li>
                            <li><Check size={14} /> Ready for flask investment burnout</li>
                        </ul>
                    </div>

                    <div className="land-feature-card">
                        <div className="land-feat-icon">
                            <Sliders size={22} className="text-gold" />
                        </div>
                        <h3 className="land-feat-title">Parametric 3D Atelier Studio</h3>
                        <p className="land-feat-desc">
                            Open reconstructed models in the 3D Atelier sandbox to adjust band widths, prong counts, gemstone cuts, and perform precision cross-section cuts.
                        </p>
                        <ul className="land-feat-bullets">
                            <li><Check size={14} /> Real-time metal alloy switching</li>
                            <li><Check size={14} /> Interactive section plane inspection</li>
                            <li><Check size={14} /> Component isolation (shank, prongs, stones)</li>
                        </ul>
                    </div>

                    <div className="land-feature-card">
                        <div className="land-feat-icon">
                            <Share2 size={22} className="text-gold" />
                        </div>
                        <h3 className="land-feat-title">Private Client 3D Presentation Portal</h3>
                        <p className="land-feat-desc">
                            Generate private, interactive 3D share links. Clients can spin, zoom, and inspect their bespoke jewelry on any phone or iPad before casting.
                        </p>
                        <ul className="land-feat-bullets">
                            <li><Check size={14} /> Instant password-free client link</li>
                            <li><Check size={14} /> 360° touch turntable on mobile</li>
                            <li><Check size={14} /> Faster approvals and deposit commitments</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                6. TRADITIONAL CAD VS JEWELCRAFT AI TABLE
               ══════════════════════════════════════════════════════ */}
            <section className="land-section land-compare-section">
                <div className="land-section-header">
                    <div className="land-section-badge gold">
                        <CheckCircle2 size={14} />
                        <span>VALUE BENCHMARK</span>
                    </div>
                    <h2 className="land-section-title">
                        Traditional Jewelry CAD vs. JewelCraft AI
                    </h2>
                </div>

                <div className="land-table-card">
                    <table className="land-compare-table">
                        <thead>
                            <tr>
                                <th>Operational Metric</th>
                                <th>Traditional Jewelry CAD</th>
                                <th className="highlight">JewelCraft AI</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="font-semibold">Turnaround Time</td>
                                <td className="text-muted">3 to 5 Business Days</td>
                                <td className="highlight-val">Under 30 Seconds</td>
                            </tr>
                            <tr>
                                <td className="font-semibold">Cost per Design Iteration</td>
                                <td className="text-muted">$150 – $400 Outsource Fee</td>
                                <td className="highlight-val">Free Tier APIs ($0)</td>
                            </tr>
                            <tr>
                                <td className="font-semibold">Photo Accuracy</td>
                                <td className="text-muted">Subjective manual interpretation</td>
                                <td className="highlight-val">1:1 Exact Neural Reconstruction</td>
                            </tr>
                            <tr>
                                <td className="font-semibold">Multi-Color Fidelity</td>
                                <td className="text-muted">Manual material assignment</td>
                                <td className="highlight-val">True Photo Vertex Color Capture</td>
                            </tr>
                            <tr>
                                <td className="font-semibold">Metal Spot Valuation</td>
                                <td className="text-muted">Manual scales & calculation</td>
                                <td className="highlight-val">Live GoldAPI Real-time Spot Quotes</td>
                            </tr>
                            <tr>
                                <td className="font-semibold">3D Wax Print Readiness</td>
                                <td className="text-muted">Frequent non-manifold mesh errors</td>
                                <td className="highlight-val">100% Watertight .STL Guarantee</td>
                            </tr>
                            <tr>
                                <td className="font-semibold">Client Presentation</td>
                                <td className="text-muted">Static 2D image renders</td>
                                <td className="highlight-val">Interactive 360° 3D Web Vitrine</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                7. FINAL CALL-TO-ACTION (CTA)
               ══════════════════════════════════════════════════════ */}
            <section className="land-cta-section">
                <div className="land-cta-card">
                    <div className="land-cta-glow" />
                    <div className="land-eyebrow mb-4">
                        <Gem size={14} className="text-gold" />
                        <span>JOIN THE GENERATIVE HAUTE JOAILLERIE ERA</span>
                    </div>
                    <h2 className="land-cta-title">
                        Step Inside the Place Vendôme AI Studio
                    </h2>
                    <p className="land-cta-sub">
                        Convert your jewelry sketches and photos into castable 3D CAD files today.
                        No credit card, no complex CAD installation — 100% free-tier ready.
                    </p>
                    <div className="land-cta-actions">
                        <button
                            className="land-btn-primary large"
                            onClick={() => navigate('/generate')}
                            id="cta-launch-studio-btn"
                        >
                            <Sparkles size={20} />
                            <span>Launch AI 3D Studio Now</span>
                            <ArrowRight size={20} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ══════════════════════════════════════════════════════
                8. LUXURY FOOTER
               ══════════════════════════════════════════════════════ */}
            <footer className="land-footer">
                <div className="land-footer-inner">
                    <div className="land-footer-brand">
                        <div className="land-footer-logo">
                            <Gem size={20} className="text-gold" />
                            <span>JewelCraft AI</span>
                        </div>
                        <p className="land-footer-desc">
                            Haute Joaillerie Generative AI Atelier.
                            Powered by Gemini 3.6 Flash, Hugging Face TripoSR, and GoldAPI.
                        </p>
                    </div>

                    <div className="land-footer-links">
                        <div className="land-link-col">
                            <span className="land-col-title">Studio</span>
                            <button onClick={() => navigate('/generate')}>AI 3D Studio</button>
                            <button onClick={() => navigate('/designer')}>3D Atelier</button>
                            <button onClick={() => navigate('/export')}>Export CAD</button>
                        </div>
                        <div className="land-link-col">
                            <span className="land-col-title">Formats</span>
                            <span>.STL (Wax Print)</span>
                            <span>.GLB (3D Web)</span>
                            <span>.OBJ (Rhino / Matrix)</span>
                        </div>
                        <div className="land-link-col">
                            <span className="land-col-title">Intelligence</span>
                            <span>Gemini 3.6 Flash</span>
                            <span>Hugging Face TripoSR</span>
                            <span>GoldAPI Spot Feed</span>
                        </div>
                    </div>
                </div>
                <div className="land-footer-bottom">
                    <span>© 2026 JewelCraft AI • Place Vendôme Luxury CAD Architecture</span>
                    <span className="land-footer-pill">Production Ready v2.4</span>
                </div>
            </footer>
        </div>
    )
}
