import { Link } from "react-router";

export default function ProfilePage() {


    return (
        <div className="flex-grow flex-col flex justify-around items-center">
            <div className="h-90 w-90 border-b-black border-2 rounded-full flex justify-center items-center">
                <div>profile</div>
            </div>
            <div className="h-100 w-90 flex justify-around items-center flex-col">
                <div>Account Made: __________</div>
                <div>Email: _________</div>
                <div>Password: **********</div>
                <Link to="/about">
                    <button className="h-10 w-20 bg-zinc-400 hover:bg-zinc-500 active:bg-zinc-600 transition-colors">
                        <div className="text-white">About</div>
                    </button>
                </Link>

            </div>
        </div>
    );
}