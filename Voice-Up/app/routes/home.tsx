import type { Route } from "./+types/home";

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {



  return (
    <div className="page">
      <div className="top">
        <div className="TopText">category dropdown menu</div>
      </div>
      <div className="middle">
        <div className = "firsttext">Greetings, user</div>
        <div className = "secondtext">Finish where you left off: </div>
        <div className="circle">
          <div className="timer">timer</div>
          <div>.</div>
          <div>.</div>
          <div className="topic">[Topic]</div>
        </div>
      </div>
      <div className="bottom">
        <div className="stats">stats</div>
        <div className="random">random</div>
        <div className="new">new</div>
        <div className="notes">notes</div>
        <div className="profile">profile</div>
      </div>
      
    </div>
  );
}
