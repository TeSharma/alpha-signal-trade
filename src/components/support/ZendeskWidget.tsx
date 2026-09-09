import { useEffect } from "react";

const ZENDESK_SCRIPT_ID = "ze-snippet";
const ZENDESK_SCRIPT_SRC =
  "https://static.zdassets.com/ekr/snippet.js?key=ab33ff8f-a2b3-44af-b1d0-d3d5fee81406";
export default function ZendeskWidget() {
  useEffect(() => {
    // Prevent the Zendesk script from being loaded more than once.
    if (document.getElementById(ZENDESK_SCRIPT_ID)) {
      return;
    }

    const script = document.createElement("script");

    script.id = ZENDESK_SCRIPT_ID;
    script.src = ZENDESK_SCRIPT_SRC;
    script.async = true;

    document.body.appendChild(script);

    return () => {
      // Don't remove the Zendesk script on normal React re-renders.
      // Zendesk manages its own widget lifecycle.
    };
  }, []);

  return null;
}