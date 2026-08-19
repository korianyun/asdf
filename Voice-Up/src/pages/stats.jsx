export default function StatsPage() {


    return (
        <div className="flex-grow flex flex-col justify-around">
            <div className="border-2 border-b-black h-120 w-96 ml-10 flex flex-col justify-center items-center text-center p-12">
                chart with days logged on app
            </div>
            <div className="border-2 border-b-black h-80 w-96 ml-10 flex justify-center items-center text-center p-12">
                chart with amount of problems done on the app every day
            </div>
        </div>
    );
}