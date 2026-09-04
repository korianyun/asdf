export default function RandomPage() {


    return (
        <div className="flex-grow flex flex-col justify-center items-center">
            <div className="h-130 w-60 flex flex-col justify-around items-center">
                <div>Topic: </div>
                <div>Time: </div>
                <div>Modifier:</div>
            </div>
            <div> </div>
            <div> </div>
            <div className="h-70 w-90 flex flex-col justify-center items-center">
                <button className="h-10 w-25 bg-zinc-400 hover:bg-zinc-500 active:bg-zinc-600 transition-colors flex justify-center items-center">
                    <div className="text-black">Randomize</div>
                </button>
            </div>

        </div>
    );
}