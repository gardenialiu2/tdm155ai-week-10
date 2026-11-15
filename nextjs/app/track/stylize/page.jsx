import { SiteHeader } from "../../components/Chrome.jsx";
import Stylize from "./Stylize.jsx";
import "../../../lib/stage/stage.css";
import "../../../lib/cv/cv.css";
import "./stylize.css";

export const metadata = { title: "Track: stylize", description: "Your camera as ASCII, watercolor, or cross-stitch." };

export default function StylizePage() {
  return (
    <>
      <SiteHeader current="track" />
      <main id="main">
        <div className="cv-page">
          <div className="cv-head">
            <p className="eyebrow">Track · Stylize</p>
            <h1>Your camera, as something handmade.</h1>
            <p className="cv-lede">Pick a look (keys <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>): ASCII characters, a watercolor wash, or cross-stitch on cloth. Everything runs in this tab; the camera never leaves your computer. Send the picture to <code>/stage</code> once, or switch on Live to stage. Each look is one function in <code>app/track/stylize/renderers.js</code>: change the ASCII ramp, the watercolor levels, or the thread colors.</p>
          </div>
          <Stylize />
        </div>
      </main>
    </>
  );
}
