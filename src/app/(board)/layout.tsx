import MasterNav from "@eliseboyd/design/nav";

/**
 * Chrome shared by the board and the project editor.
 *
 * These two routes are a group rather than the root layout so that /embed and
 * /login stay bare: /embed is rendered inside someone else's iframe, where a
 * bar linking out to other apps is wrong, and /login should offer one
 * destination, not four. A route group changes no URLs.
 *
 * Everything in here is behind middleware's Supabase gate, so there is no
 * signed-in check to make — reaching this layout already means signed in.
 */
export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MasterNav current="kanban" />
      {children}
    </>
  );
}
