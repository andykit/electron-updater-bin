import { BlockMap } from "builder-util-runtime/out/blockMapApi";
import { DifferentialDownloader } from "./DifferentialDownloader";
export declare class GenericDifferentialDownloader extends DifferentialDownloader {
    download(oldBlockMap: BlockMap, newBlockMap: BlockMap): Promise<void>;
}
