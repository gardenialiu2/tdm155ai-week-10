import { SiteHeader } from "../../components/Chrome.jsx";
import Stylize from "../stylize/Stylize.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/cv/cv.css";
import "../stylize/stylize.css";

export const metadata = { title: "Extensions", description: "Camera stylizer and voice ikebana, on one page." };

// Every extension on one scrolling page. The pieces keep their own routes too:
// /track/stylize (app/track/stylize/) and /track/ikebana (app/track/ikebana/, public/ikebana/index.html).
export default function ExtensionsPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <div className="cv-page">
          <div className="cv-head">
            <p className="eyebrow">Extensions</p>
            <h1>Camera and voice, made by hand.</h1>
            <p className="cv-lede">Two things added to the class app, each ending in the same stage cue as everything else. Scroll down, or jump: <a href="#stylize">Stylize</a> · <a href="#ikebana">Ikebana</a>. Open <code>/stage</code> in another window and use <strong>Send picture to stage</strong>, <strong>Live to stage</strong>, or the ikebana <strong>Stage</strong> buttons.</p>
          </div>

          <section id="stylize" className="ext-section">
            <p className="eyebrow">1 · Camera in</p>
            <h2>Stylize: ASCII, watercolor, cross-stitch, pixel art</h2>
            <p className="cv-lede">Keys <kbd>1</kbd> to <kbd>4</kbd> switch the look. <strong>Face only</strong> keeps just your face. <strong>Build up</strong> (<kbd>B</kbd>) draws the picture in piece by piece. Each look is one function in <code>app/track/stylize/renderers.js</code>.</p>
            <Stylize />
          </section>

          <section id="ikebana" className="ext-section">
            <p className="eyebrow">2 · Voice in</p>
            <h2>Ikebana: arrange flowers by hand or by voice</h2>
            <p className="cv-lede">Pick a flower and click to place it, or press <strong>Voice</strong> and say a flower (&ldquo;rose&rdquo;, &ldquo;tulip&rdquo;, &ldquo;lavender&rdquo;), a vase (&ldquo;dish&rdquo;, &ldquo;slab&rdquo;), or &ldquo;clear&rdquo; and &ldquo;surprise&rdquo;. The arranger is <code>public/ikebana/index.html</code>.</p>
            <iframe src="/ikebana/index.html" title="Ikebana flower arranger" className="ext-frame" allow="microphone" />
          </section>
        </div>
      </main>
    </>
  );
}
