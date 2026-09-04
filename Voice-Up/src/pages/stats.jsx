export default function StatsPage() {


    return (
        <div className="flex-grow flex flex-row justify-around items-center">
            <div className="flex flex-col justify-between h-200 items-center">
                <div className="border-2 border-b-black h-110 w-96 ml-10 flex flex-col justify-center items-center text-center p-12">
                    chart with days logged on app
                </div>
                <div className="border-2 border-b-black h-75 w-96 ml-10 flex justify-center items-center text-center p-12">
                    chart with amount of problems done on the app every day
                </div>
            </div>
            <div className="h-200 w-200 flex flex-col justify-between content-between">
                <div className="h-50 w-200 flex flex-row justify-between">
                    <div className="border-2 border-b-black h-50 w-75 flex justify-center items-center">total time spent on app</div>
                    <div className="border-2 border-b-black h-50 w-115 flex justify-center items-center">ranking on app</div>
                </div>
                <div className="h-80 w-200 flex flex-row justify-between">
                    <div className="border-2 border-b-black h-80 w-200 flex justify-center items-center">% of problems completed (and left)</div>
                </div>
                <div className="h-60 w-200 flex flex-row justify-between">
                    <div className="border-2 border-b-black h-60 w-120 flex justify-center items-center">accuracy on problems</div>
                    <div className="border-2 border-b-black h-60 w-70 flex justify-center items-center">favorite topics</div>
                </div>
            </div>
            <div className="flex flex-col justify-between">
                <div className="border-2 border-b-black h-200 w-80 flex justify-center items-center">topics to work on:</div>
            </div>

        </div>
    );
}