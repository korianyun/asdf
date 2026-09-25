import { Link } from "react-router";


export default function ProfilePage() {


    return (
        <div className="flex-grow flex-col flex justify-around items-center bg-[#f9f5f1]">
            <div className="h-160 w-130 border-6 border-[#b97f55] bg-[#debba1] flex flex-col justify-center rounded-4xl items-center">
                <div className="bg-[#f9f5f1] h-70 w-70 border-b-black border-2 flex justify-center rounded-full items-center">
                    <div>profile</div>
                </div>
                <div className="h-50 w-100 flex justify-around items-center flex-col">
                    <div>Account Made: __________</div>
                    <div>Email: _________</div>
                    <div>Password: **********</div>
                </div>
            </div>
            <Link to="/about">
                <button className=" rounded-2xl h-10 w-20  hover:bg-[#d49263] transition-colors bg-[#b97f55]">
                    <div className="text-white">About</div>
                </button>
            </Link>


        </div>
    );
}