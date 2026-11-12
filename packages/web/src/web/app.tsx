import { Route, Switch } from "wouter";
import Index from "./pages/index";
import ProjectorPage from "./pages/projector";
import StreamPage from "./pages/stream";
import BroadcastPage from "./pages/broadcast";
import StagePage from "./pages/stage";
import RemotePage from "./pages/remote";
import CastPage from "./pages/cast";
import { EntitlementGate } from "./components/entitlement-gate";
import { Provider } from "./components/provider";
import { CustomFontFaces } from "./hooks/use-fonts";
import { AgentFeedback } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      {/* The operator's own fonts, registered on every surface that draws words. */}
      <CustomFontFaces />
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/projector" component={ProjectorPage} />
        <Route path="/stream" component={StreamPage} />
        <Route path="/broadcast" component={BroadcastPage} />
        <Route path="/stage" component={StagePage} />
        <Route path="/remote" component={RemotePage} />
        <Route path="/cast" component={CastPage} />
      </Switch>
      {/* Off unless the owner switches the subscription policy on; operator screen only. */}
      <EntitlementGate />
      {/* Do not remove - off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
    </Provider>
  );
}

export default App;
