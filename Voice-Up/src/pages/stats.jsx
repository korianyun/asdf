export default function StatsPage() {


    return (
        <div className="flex-grow flex flex-row justify-around items-center bg-[#f9f5f1]">
            <div className="flex flex-col justify-between h-190 items-center">
                <div className="border-2  border-[#b97f55] h-110 w-96 ml-10 flex flex-col justify-center items-center text-center p-12 bg-[#debba1] rounded-2xl">
                    chart with days logged on app
                </div>
                <div className="border-2 border-[#b97f55] h-75 w-96 ml-10 flex justify-center items-center text-center p-12 bg-[#debba1] rounded-2xl">
                    chart with amount of problems done on the app every day
                </div>
            </div>
            <div className="h-190 w-200 flex flex-col justify-between content-between">
                <div className="h-50 w-200 flex flex-row justify-between">
                    <div className="border-2 border-[#b97f55] h-50 w-75 flex justify-center items-center bg-[#debba1] rounded-2xl">total time spent on app</div>
                    <div className="border-2 border-[#b97f55] h-50 w-115 flex justify-center items-center bg-[#debba1] rounded-2xl">ranking on app</div>
                </div>
                <div className="h-80 w-200 flex flex-row justify-between">
                    <div className="border-2 border-[#b97f55] h-80 w-200 flex justify-center items-center bg-[#debba1] rounded-2xl">% of problems completed (and left)</div>
                </div>
                <div className="h-50 w-200 flex flex-row justify-between">
                    <div className="border-2 border-[#b97f55] h-50 w-120 flex justify-center items-center bg-[#debba1] rounded-2xl">accuracy on problems</div>
                    <div className="border-2 border-[#b97f55] h-50 w-70 flex justify-center items-center bg-[#debba1] rounded-2xl">favorite topics</div>
                </div>
            </div>
            <div className="flex flex-col justify-between">
                <div className="border-2 border-[#b97f55] h-190 w-80 flex justify-center items-center bg-[#debba1] rounded-2xl">topics to work on:</div>
            </div>

        </div>
    );
}