import { SiteHeader } from "../../components/Chrome.jsx";
import "../../../lib/cv/cv.css";

export const metadata = { title: "Track: ikebana", description: "Arrange pixel and ASCII flowers by hand or by voice, and send the arrangement to the stage." };

// The arranger itself is one self-contained page: public/ikebana/index.html. It talks to /stage over the same
// BroadcastChannel as the rest of the app, so it is embedded here rather than rewritten as a component.
export default function IkebanaPage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <div className="cv-page">
          <div className="cv-head">
            <p className="eyebrow">Voice · Ikebana</p>
            <h1>Arrange flowers by hand or by voice.</h1>
            <p className="cv-lede">Pick a flower and click to place it, or press <strong>Voice</strong> and say a flower (&ldquo;rose&rdquo;, &ldquo;tulip&rdquo;, &ldquo;lavender&rdquo;), a vase (&ldquo;dish&rdquo;, &ldquo;slab&rdquo;), or &ldquo;clear&rdquo; and &ldquo;surprise&rdquo;. <strong>Send to stage</strong> puts the arrangement on <code>/stage</code>; <strong>Live</strong> keeps it updated as you arrange. The whole arranger is <code>public/ikebana/index.html</code>.</p>
          </div>
          <iframe src="/ikebana/index.html" title="Ikebana flower arranger" style={{ width: "100%", height: "1150px", border: "1px solid #243038", borderRadius: 6, background: "#0c1013" }} allow="microphone" />
        </div>
      </main>
    </>
  );
}
